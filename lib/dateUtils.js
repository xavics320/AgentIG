// new Date().toISOString() restituisce sempre la data in UTC, che puo'
// differire dalla data locale (es. di notte, prima delle 2 del mattino
// in Italia, in UTC e' ancora il giorno precedente). Questa funzione
// calcola la data "di oggi" nel fuso orario indicato, in formato YYYY-MM-DD.
export function getTodayInTimezone(timeZone = 'Europe/Rome') {
  // Intl.DateTimeFormat con locale 'en-CA' restituisce le date gia'
  // nel formato YYYY-MM-DD, comodo da usare direttamente
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}