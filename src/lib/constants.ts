export const TIMEZONE = 'America/Panama'

// Court operating hours (local time, inclusive)
export const COURT_OPEN_HOUR = 6   // 6 AM
export const COURT_CLOSE_HOUR = 22 // 10 PM (last slot starts at 21:00)

export const HOURS = Array.from(
  { length: COURT_CLOSE_HOUR - COURT_OPEN_HOUR },
  (_, i) => COURT_OPEN_HOUR + i
)

export const DAY_NAMES_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export const MONTH_NAMES_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]
