export function formatDateRange(dateRange: string): string {
  if (!dateRange) return ''
  return dateRange
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const [year, month] = dateStr.split('-')
    if (!year) return dateStr
    if (!month) return year
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthIndex = parseInt(month, 10) - 1
    return `${months[monthIndex]} ${year}`
  } catch {
    return dateStr
  }
}
