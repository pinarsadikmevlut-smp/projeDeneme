export const formatPrice=(value)=>new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
export const formatTime=(date)=>new Intl.DateTimeFormat('tr-TR',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Europe/Istanbul'}).format(date);
