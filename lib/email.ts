export async function sendBookingConfirmation(r: any) { return { data: null } }
export async function sendPaymentConfirmation(r: any, a: number) { return { data: null } }
export async function sendArrivalReminder(r: any) { return { data: null } }
export async function sendAdminNotification(r: any, s: string, m: string) { return { data: null } }
```

Uložte (Typ souboru: Všechny soubory, název: `email.ts`) do složky `lib\`. Pak:
```
rmdir /s /q .next
npm run dev