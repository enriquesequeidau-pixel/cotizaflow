export function localDate(d=new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function nextQuoteNumber(quotes) { let n=1;const used=new Set(quotes.map(q=>q.number));while(used.has(`COT-${String(n).padStart(4,'0')}`))n++;return `COT-${String(n).padStart(4,'0')}`; }
export function matchesFilters(text,status,query,selectedStatus) { return text.toLocaleLowerCase().includes(query.toLocaleLowerCase())&&(!selectedStatus||status===selectedStatus); }
