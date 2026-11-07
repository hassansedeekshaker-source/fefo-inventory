-- Applied to Supabase project fyqyodnboryzaejlhdlk as migration 20261107104103_atomic_sales_and_sales_returns_posting.
-- This migration makes sales and sales-return posting atomic: stock, FEFO lots, weighted-average cost,
-- journal entries, and document status are committed together or rolled back together.

create unique index if not exists journal_entries_sales_source_unique_uq
  on public.journal_entries(source_type, source_id)
  where source_type in ('sale', 'sale_return') and source_id is not null;

CREATE OR REPLACE FUNCTION public.post_sale_atomic(p_sale_id uuid, p_created_by uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  h public.sales%rowtype;
  x record;
  ic public.inventory_costs%rowtype;
  lot public.inv_lots%rowtype;
  v_subtotal numeric := 0;
  v_tax_total numeric := 0;
  v_cogs numeric := 0;
  v_avg_cost numeric;
  v_item_cost numeric;
  v_remaining numeric;
  v_take numeric;
  v_new_qty numeric;
  v_new_value numeric;
  v_ar_amount numeric;
  v_ar_account uuid;
  v_sales_account uuid;
  v_inventory_account uuid;
  v_cogs_account uuid;
  v_vat_account uuid;
  v_withholding_account uuid;
  v_entry_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_created_by then
    raise exception 'المستخدم الحالي لا يطابق منشئ عملية الترحيل.';
  end if;

  select * into h
  from public.sales
  where id = p_sale_id
  for update;

  if not found or h.status <> 'draft' then
    raise exception 'فاتورة المبيعات غير موجودة أو ليست مسودة.';
  end if;

  if h.customer_id is null then
    raise exception 'يجب تحديد العميل قبل ترحيل فاتورة المبيعات.';
  end if;

  if exists (
    select 1 from public.journal_entries
    where source_type = 'sale' and source_id = p_sale_id
  ) then
    raise exception 'يوجد قيد سابق لهذه الفاتورة؛ أوقفنا الترحيل لمنع التكرار.';
  end if;

  if not exists (
    select 1 from public.sale_lines where sale_id = p_sale_id
  ) then
    raise exception 'فاتورة المبيعات لا تحتوي على أصناف.';
  end if;

  for x in
    select sl.*
    from public.sale_lines sl
    where sl.sale_id = p_sale_id
    for update
  loop
    if x.qty <= 0 or x.unit_price < 0 then
      raise exception 'الكمية أو سعر البيع غير صحيح في أحد البنود.';
    end if;
    if x.discount_amount < 0
       or x.discount_amount > round(x.qty * x.unit_price, 2) + 0.01
       or x.tax_amount < 0
       or x.tax_rate < 0 then
      raise exception 'الخصم أو الضريبة غير صحيح في أحد بنود المبيعات.';
    end if;
    if abs(
      round(x.tax_amount, 2)
      - round((round(x.qty * x.unit_price, 2) - round(x.discount_amount, 2)) * x.tax_rate, 2)
    ) > 0.02 then
      raise exception 'قيمة ضريبة أحد بنود المبيعات لا تطابق نسبة الضريبة.';
    end if;

    v_subtotal := v_subtotal + round(x.qty * x.unit_price - x.discount_amount, 2);
    v_tax_total := v_tax_total + round(x.tax_amount, 2);
  end loop;

  if abs(round(h.subtotal, 2) - round(v_subtotal, 2)) > 0.02
     or abs(round(h.tax, 2) - round(v_tax_total, 2)) > 0.02
     or abs(round(h.total, 2) - round(v_subtotal + v_tax_total, 2)) > 0.02 then
    raise exception 'إجمالي الفاتورة لا يطابق مجموع بنودها أو ضريبتها.';
  end if;

  if h.withholding_tax < 0 or h.withholding_tax > h.total then
    raise exception 'قيمة خصم المنبع غير صحيحة.';
  end if;

  -- Lock every item balance in a stable order and verify FEFO lots before changing stock.
  for x in
    select sl.item_id, sum(sl.qty) as qty
    from public.sale_lines sl
    where sl.sale_id = p_sale_id
    group by sl.item_id
    order by sl.item_id
  loop
    select * into ic
    from public.inventory_costs
    where item_id = x.item_id and site_id = h.site_id
    for update;

    if not found or coalesce(ic.qty_on_hand, 0) + 0.000001 < x.qty then
      raise exception 'الرصيد المخزني غير كافٍ للصنف %.', x.item_id;
    end if;

    v_avg_cost := coalesce(
      nullif(ic.weighted_avg_cost, 0),
      case when ic.qty_on_hand > 0 then ic.inventory_value / ic.qty_on_hand else 0 end
    );

    if v_avg_cost < 0 then
      raise exception 'متوسط تكلفة المخزون سالب للصنف %.', x.item_id;
    end if;

    if (
      select coalesce(sum(greatest(l.qty_on_hand - l.qty_reserved, 0)), 0)
      from public.inv_lots l
      where l.item_id = x.item_id
        and l.site_id = h.site_id
        and l.qty_on_hand > l.qty_reserved
    ) + 0.000001 < x.qty then
      raise exception 'كميات التشغيلات المتاحة لا تكفي للصنف %؛ راجع رصيد المخزون والتشغيلات.', x.item_id;
    end if;

    perform 1
    from public.inv_lots l
    where l.item_id = x.item_id
      and l.site_id = h.site_id
      and l.qty_on_hand > l.qty_reserved
    order by l.expiry_date nulls last, l.received_at, l.id
    for update;

    v_item_cost := round(x.qty * v_avg_cost, 3);
    v_cogs := v_cogs + v_item_cost;
  end loop;

  -- Issue quantities by FEFO lots, while valuing the issue at the moving weighted average.
  for x in
    select sl.item_id, sum(sl.qty) as qty
    from public.sale_lines sl
    where sl.sale_id = p_sale_id
    group by sl.item_id
    order by sl.item_id
  loop
    select * into ic
    from public.inventory_costs
    where item_id = x.item_id and site_id = h.site_id
    for update;

    v_avg_cost := coalesce(
      nullif(ic.weighted_avg_cost, 0),
      case when ic.qty_on_hand > 0 then ic.inventory_value / ic.qty_on_hand else 0 end
    );
    v_item_cost := round(x.qty * v_avg_cost, 3);
    v_remaining := x.qty;

    for lot in
      select l.*
      from public.inv_lots l
      where l.item_id = x.item_id
        and l.site_id = h.site_id
        and l.qty_on_hand > l.qty_reserved
      order by l.expiry_date nulls last, l.received_at, l.id
      for update
    loop
      exit when v_remaining <= 0.000001;
      v_take := least(v_remaining, lot.qty_on_hand - lot.qty_reserved);

      if v_take > 0 then
        update public.inv_lots
        set qty_on_hand = qty_on_hand - v_take
        where id = lot.id;

        insert into public.inv_movements(
          item_id, site_id, lot_id, movement_type, qty, unit_cost,
          reference_type, reference_id, notes, created_by
        )
        values(
          x.item_id, h.site_id, lot.id, 'issue', v_take, v_avg_cost,
          'sale', p_sale_id, 'ترحيل مبيعات FEFO — تكلفة المتوسط المرجح', p_created_by
        );

        v_remaining := v_remaining - v_take;
      end if;
    end loop;

    if v_remaining > 0.000001 then
      raise exception 'تعذر استكمال صرف التشغيلات للصنف %؛ ألغيت العملية بالكامل.', x.item_id;
    end if;

    v_new_qty := ic.qty_on_hand - x.qty;
    v_new_value := case
      when v_new_qty <= 0.000001 then 0
      else greatest(0, round(ic.inventory_value - v_item_cost, 3))
    end;

    update public.inventory_costs
    set qty_on_hand = greatest(0, v_new_qty),
        inventory_value = v_new_value,
        weighted_avg_cost = case when v_new_qty > 0.000001 then v_new_value / v_new_qty else 0 end,
        updated_at = now()
    where item_id = x.item_id and site_id = h.site_id;

    update public.sale_lines
    set unit_cost = v_avg_cost
    where sale_id = p_sale_id and item_id = x.item_id;
  end loop;

  select id into v_ar_account
  from public.coa_accounts where code = '1300' and active and is_postable limit 1;
  select id into v_sales_account
  from public.coa_accounts where code = '4100' and active and is_postable limit 1;
  select id into v_inventory_account
  from public.coa_accounts where code = '1310' and active and is_postable limit 1;
  select id into v_cogs_account
  from public.coa_accounts where code = '5100' and active and is_postable limit 1;
  select id into v_vat_account
  from public.coa_accounts where code = '2220' and active and is_postable limit 1;
  select id into v_withholding_account
  from public.coa_accounts where code = '1350' and active and is_postable limit 1;

  if v_ar_account is null or v_sales_account is null
     or v_inventory_account is null or v_cogs_account is null
     or (h.tax > 0 and v_vat_account is null)
     or (h.withholding_tax > 0 and v_withholding_account is null) then
    raise exception 'تعذر العثور على أحد حسابات العملاء أو المبيعات أو المخزون أو التكلفة أو الضرائب.';
  end if;

  v_ar_amount := round(h.total - h.withholding_tax, 2);

  insert into public.journal_entries(
    entry_date, source_type, source_id, description, posted, created_by
  )
  values(
    h.sale_date, 'sale', p_sale_id,
    'ترحيل فاتورة مبيعات ' || coalesce(h.invoice_no, ''),
    true, p_created_by
  )
  returning id into v_entry_id;

  insert into public.journal_lines(entry_id, account_id, debit, credit, description, site_id)
  values
    (v_entry_id, v_ar_account, v_ar_amount, 0, 'استحقاق العميل بعد خصم المنبع', h.site_id),
    (v_entry_id, v_sales_account, 0, h.subtotal, 'المبيعات بعد الخصم', h.site_id),
    (v_entry_id, v_cogs_account, round(v_cogs, 3), 0, 'تكلفة البضاعة المباعة بالمتوسط المرجح', h.site_id),
    (v_entry_id, v_inventory_account, 0, round(v_cogs, 3), 'تخفيض المخزون بتكلفة المتوسط المرجح', h.site_id);

  if h.tax > 0 then
    insert into public.journal_lines(entry_id, account_id, debit, credit, description, site_id)
    values(v_entry_id, v_vat_account, 0, h.tax, 'ضريبة قيمة مضافة مخرجات', h.site_id);
  end if;

  if h.withholding_tax > 0 then
    insert into public.journal_lines(entry_id, account_id, debit, credit, description, site_id)
    values(v_entry_id, v_withholding_account, h.withholding_tax, 0, 'ضريبة خصم من المنبع مستحقة لدى العميل', h.site_id);
  end if;

  if abs(round((v_ar_amount + h.withholding_tax + v_cogs)
               - (h.subtotal + h.tax + v_cogs), 2)) > 0.02 then
    raise exception 'القيد المحاسبي لفاتورة المبيعات غير متوازن؛ ألغيت العملية بالكامل.';
  end if;

  update public.sales
  set status = 'posted'
  where id = p_sale_id and status = 'draft';

  if not found then
    raise exception 'تغيرت حالة فاتورة المبيعات أثناء الترحيل؛ ألغيت العملية بالكامل.';
  end if;

  return jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'entry_id', v_entry_id,
    'cogs', round(v_cogs, 3),
    'subtotal', h.subtotal,
    'tax', h.tax,
    'status', 'posted'
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.post_sale_return_atomic(p_return_id uuid, p_created_by uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  h public.sales_returns%rowtype;
  x record;
  source_line public.sale_lines%rowtype;
  source_sale public.sales%rowtype;
  ic public.inventory_costs%rowtype;
  v_source_line_id uuid;
  v_source_cost numeric;
  v_avg_cost numeric;
  v_line_cost numeric;
  v_line_value numeric;
  v_subtotal numeric := 0;
  v_tax_total numeric := 0;
  v_return_cost numeric := 0;
  v_customer_credit numeric;
  v_return_account uuid;
  v_customer_account uuid;
  v_inventory_account uuid;
  v_cogs_account uuid;
  v_vat_account uuid;
  v_withholding_account uuid;
  v_entry_id uuid;
  v_prior_returned numeric;
  v_current_returned numeric;
  v_new_qty numeric;
  v_new_value numeric;
  v_lot_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_created_by then
    raise exception 'المستخدم الحالي لا يطابق منشئ عملية الترحيل.';
  end if;

  select * into h
  from public.sales_returns
  where id = p_return_id
  for update;

  if not found or h.status <> 'draft' then
    raise exception 'مرتجع المبيعات غير موجود أو ليس مسودة.';
  end if;

  if h.customer_id is null then
    raise exception 'يجب تحديد العميل قبل ترحيل مرتجع المبيعات.';
  end if;

  if exists (
    select 1 from public.journal_entries
    where source_type = 'sale_return' and source_id = p_return_id
  ) then
    raise exception 'يوجد قيد سابق لهذا المرتجع؛ أوقفنا الترحيل لمنع التكرار.';
  end if;

  if not exists (
    select 1 from public.sales_return_lines where return_id = p_return_id
  ) then
    raise exception 'مرتجع المبيعات لا يحتوي على أصناف.';
  end if;

  if h.sale_id is not null then
    select * into source_sale
    from public.sales
    where id = h.sale_id
    for update;

    if not found or source_sale.status <> 'posted'
       or source_sale.customer_id <> h.customer_id
       or source_sale.site_id <> h.site_id then
      raise exception 'فاتورة البيع الأصلية غير مرحلة أو لا تطابق العميل والمخزن.';
    end if;
  end if;

  for x in
    select rl.*
    from public.sales_return_lines rl
    where rl.return_id = p_return_id
    for update
  loop
    if x.qty <= 0 or x.unit_price < 0
       or x.discount_amount < 0
       or x.discount_amount > round(x.qty * x.unit_price, 2) + 0.01
       or x.tax_amount < 0 or x.tax_rate < 0 then
      raise exception 'الكمية أو السعر أو الخصم أو الضريبة غير صحيحة في أحد بنود المرتجع.';
    end if;

    if abs(
      round(x.tax_amount, 2)
      - round((round(x.qty * x.unit_price, 2) - round(x.discount_amount, 2)) * x.tax_rate, 2)
    ) > 0.02 then
      raise exception 'ضريبة أحد بنود المرتجع لا تطابق نسبة الضريبة.';
    end if;

    v_subtotal := v_subtotal + round(x.qty * x.unit_price - x.discount_amount, 2);
    v_tax_total := v_tax_total + round(x.tax_amount, 2);

    v_source_line_id := coalesce(x.source_sale_line_id, x.sale_line_id);

    if v_source_line_id is not null then
      select * into source_line
      from public.sale_lines
      where id = v_source_line_id
      for update;

      if not found then
        raise exception 'بند فاتورة البيع الأصلية المرتبط بالمرتجع غير موجود.';
      end if;

      select * into source_sale
      from public.sales
      where id = source_line.sale_id
      for update;

      if not found or source_sale.status <> 'posted'
         or source_sale.customer_id <> h.customer_id
         or source_sale.site_id <> h.site_id
         or source_line.item_id <> x.item_id
         or (h.sale_id is not null and h.sale_id <> source_sale.id) then
        raise exception 'بند المرتجع لا يطابق فاتورة البيع الأصلية أو العميل أو المخزن.';
      end if;

      select coalesce(sum(rl.qty), 0) into v_prior_returned
      from public.sales_return_lines rl
      join public.sales_returns rh on rh.id = rl.return_id
      where coalesce(rl.source_sale_line_id, rl.sale_line_id) = v_source_line_id
        and rh.status = 'posted';

      select coalesce(sum(rl.qty), 0) into v_current_returned
      from public.sales_return_lines rl
      where rl.return_id = p_return_id
        and coalesce(rl.source_sale_line_id, rl.sale_line_id) = v_source_line_id;

      if v_prior_returned + v_current_returned > source_line.qty + 0.000001 then
        raise exception 'كمية المرتجع تتجاوز الكمية المباعة في الفاتورة الأصلية.';
      end if;
    elsif h.sale_id is not null then
      raise exception 'عند تحديد فاتورة أصلية يجب ربط كل بند مرتجع ببند الفاتورة الأصلية.';
    end if;
  end loop;

  if abs(round(h.subtotal, 2) - round(v_subtotal, 2)) > 0.02
     or abs(round(h.tax, 2) - round(v_tax_total, 2)) > 0.02
     or abs(round(h.total, 2) - round(v_subtotal + v_tax_total, 2)) > 0.02
     or abs(round(coalesce(h.discount_total, 0), 2)
            - round((select coalesce(sum(discount_amount), 0)
                     from public.sales_return_lines where return_id = p_return_id), 2)) > 0.02 then
    raise exception 'إجمالي المرتجع أو الخصم أو الضريبة لا يطابق مجموع البنود.';
  end if;

  if h.withholding_tax < 0 or h.withholding_tax > h.total then
    raise exception 'قيمة خصم المنبع في المرتجع غير صحيحة.';
  end if;

  -- Ensure a locked cost row exists for each returned item.
  insert into public.inventory_costs(item_id, site_id, qty_on_hand, inventory_value, weighted_avg_cost)
  select rl.item_id, h.site_id, 0, 0, 0
  from public.sales_return_lines rl
  where rl.return_id = p_return_id
  group by rl.item_id
  on conflict(item_id, site_id) do nothing;

  for x in
    select distinct rl.item_id
    from public.sales_return_lines rl
    where rl.return_id = p_return_id
    order by rl.item_id
  loop
    perform 1
    from public.inventory_costs
    where item_id = x.item_id and site_id = h.site_id
    for update;
  end loop;

  -- Restore each line at the original posted sale cost when linked; otherwise use current moving average.
  for x in
    select rl.*
    from public.sales_return_lines rl
    where rl.return_id = p_return_id
    for update
  loop
    v_source_line_id := coalesce(x.source_sale_line_id, x.sale_line_id);
    v_source_cost := null;

    if v_source_line_id is not null then
      select sl.unit_cost into v_source_cost
      from public.sale_lines sl
      where sl.id = v_source_line_id;
    end if;

    select * into ic
    from public.inventory_costs
    where item_id = x.item_id and site_id = h.site_id
    for update;

    v_avg_cost := coalesce(
      nullif(ic.weighted_avg_cost, 0),
      case when ic.qty_on_hand > 0 then ic.inventory_value / ic.qty_on_hand else null end,
      nullif(x.unit_cost, 0),
      0
    );

    if coalesce(v_source_cost, 0) > 0 then
      v_avg_cost := v_source_cost;
    end if;

    v_line_cost := round(greatest(0, v_avg_cost), 3);
    v_line_value := round(x.qty * v_line_cost, 3);
    v_return_cost := v_return_cost + v_line_value;

    update public.sales_return_lines
    set unit_cost = v_line_cost
    where id = x.id;

    insert into public.inv_lots(
      item_id, site_id, qty_on_hand, qty_reserved, unit_cost, received_at
    )
    values(
      x.item_id, h.site_id, x.qty, 0, v_line_cost, now()
    )
    returning id into v_lot_id;

    insert into public.inv_movements(
      item_id, site_id, lot_id, movement_type, qty, unit_cost,
      reference_type, reference_id, notes, created_by
    )
    values(
      x.item_id, h.site_id, v_lot_id, 'receipt', x.qty, v_line_cost,
      'sale_return', p_return_id, 'ترحيل مرتجع مبيعات — إعادة المخزون بتكلفة المرتجع المعتمدة',
      p_created_by
    );
  end loop;

  for x in
    select rl.item_id,
           sum(rl.qty) as qty,
           sum(round(rl.qty * rl.unit_cost, 3)) as value
    from public.sales_return_lines rl
    where rl.return_id = p_return_id
    group by rl.item_id
    order by rl.item_id
  loop
    select * into ic
    from public.inventory_costs
    where item_id = x.item_id and site_id = h.site_id
    for update;

    v_new_qty := ic.qty_on_hand + x.qty;
    v_new_value := round(ic.inventory_value + x.value, 3);

    update public.inventory_costs
    set qty_on_hand = v_new_qty,
        inventory_value = v_new_value,
        weighted_avg_cost = case when v_new_qty > 0 then v_new_value / v_new_qty else 0 end,
        updated_at = now()
    where item_id = x.item_id and site_id = h.site_id;
  end loop;

  select id into v_return_account
  from public.coa_accounts where code = '4200' and active and is_postable limit 1;
  select id into v_customer_account
  from public.coa_accounts where code = '1300' and active and is_postable limit 1;
  select id into v_inventory_account
  from public.coa_accounts where code = '1310' and active and is_postable limit 1;
  select id into v_cogs_account
  from public.coa_accounts where code = '5100' and active and is_postable limit 1;
  select id into v_vat_account
  from public.coa_accounts where code = '2220' and active and is_postable limit 1;
  select id into v_withholding_account
  from public.coa_accounts where code = '1350' and active and is_postable limit 1;

  if v_return_account is null or v_customer_account is null
     or v_inventory_account is null or v_cogs_account is null
     or (h.tax > 0 and v_vat_account is null)
     or (h.withholding_tax > 0 and v_withholding_account is null) then
    raise exception 'تعذر العثور على أحد حسابات مرتجعات المبيعات أو العملاء أو المخزون أو التكلفة أو الضرائب.';
  end if;

  v_customer_credit := round(h.total - h.withholding_tax, 2);

  insert into public.journal_entries(
    entry_date, source_type, source_id, description, posted, created_by
  )
  values(
    h.return_date, 'sale_return', p_return_id,
    'مرتجع مبيعات رقم ' || h.return_no,
    true, p_created_by
  )
  returning id into v_entry_id;

  insert into public.journal_lines(entry_id, account_id, debit, credit, description, site_id)
  values
    (v_entry_id, v_return_account, h.subtotal, 0, 'عكس إيراد المبيعات — مرتجعات', h.site_id),
    (v_entry_id, v_customer_account, 0, v_customer_credit, 'خفض مستحق العميل بعد خصم المنبع', h.site_id),
    (v_entry_id, v_inventory_account, round(v_return_cost, 3), 0, 'إعادة البضاعة للمخزون بتكلفة المرتجع', h.site_id),
    (v_entry_id, v_cogs_account, 0, round(v_return_cost, 3), 'عكس تكلفة البضاعة المباعة', h.site_id);

  if h.tax > 0 then
    insert into public.journal_lines(entry_id, account_id, debit, credit, description, site_id)
    values(v_entry_id, v_vat_account, h.tax, 0, 'عكس ضريبة القيمة المضافة للمبيعات المرتجعة', h.site_id);
  end if;

  if h.withholding_tax > 0 then
    insert into public.journal_lines(entry_id, account_id, debit, credit, description, site_id)
    values(v_entry_id, v_withholding_account, 0, h.withholding_tax, 'عكس ضريبة خصم المنبع الخاصة بالمرتجع', h.site_id);
  end if;

  if abs(round((h.subtotal + h.tax + v_return_cost)
               - (v_customer_credit + h.withholding_tax + v_return_cost), 2)) > 0.02 then
    raise exception 'قيد مرتجع المبيعات غير متوازن؛ ألغيت العملية بالكامل.';
  end if;

  update public.sales_returns
  set status = 'posted'
  where id = p_return_id and status = 'draft';

  if not found then
    raise exception 'تغيرت حالة مرتجع المبيعات أثناء الترحيل؛ ألغيت العملية بالكامل.';
  end if;

  return jsonb_build_object(
    'success', true,
    'return_id', p_return_id,
    'entry_id', v_entry_id,
    'return_cost', round(v_return_cost, 3),
    'subtotal', h.subtotal,
    'tax', h.tax,
    'status', 'posted'
  );
end;
$function$

revoke all on function public.post_sale_atomic(uuid, uuid) from public, anon;
revoke all on function public.post_sale_return_atomic(uuid, uuid) from public, anon;
grant execute on function public.post_sale_atomic(uuid, uuid) to authenticated, service_role;
grant execute on function public.post_sale_return_atomic(uuid, uuid) to authenticated, service_role;
