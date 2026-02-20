export function normalizeRecord(record: any) {
  // Convert DD/MM/YYYY → YYYY-MM-DD
  const [day, month, year] = record.arrival_date.split("/");

  const formattedDate = `${year}-${month}-${day}`;

  return {
    commodity_name: record.commodity,
    mandi_name: record.market,
    state: record.state,
    modal_price: Number(record.modal_price),
    min_price: Number(record.min_price),
    max_price: Number(record.max_price),
    arrival_quantity: record.arrival_quantity
      ? Number(record.arrival_quantity)
      : null,
    date: formattedDate,
  };
}