# Gacha Pop

เว็บ Gacha Pop โทน Pastel Purple / Kawaii สร้างด้วย Next.js App Router, TypeScript และ Tailwind CSS

## Run Local

```bash
npm install
npm run dev
```

เปิดเว็บที่ `http://localhost:3000`

## Deploy บน Vercel

1. อัปโหลดโปรเจกต์นี้ขึ้น GitHub
2. เข้า Vercel แล้วเลือก `Add New Project`
3. Import repo นี้จาก GitHub
4. ใช้ค่า default ของ Vercel ได้เลย
5. กด Deploy

Build command:

```bash
npm run build
```

หมายเหตุ: ตอนนี้ระบบข้อมูลยังเป็น mock/localStorage เหมาะสำหรับเดโม หากเปิดใช้งานจริงควรต่อฐานข้อมูล เช่น Supabase หรือ Firebase

## Discord Order Webhook

ถ้าต้องการให้ Discord แจ้งเตือนเมื่อมีออเดอร์จัดส่งใหม่ ให้เพิ่มค่า env นี้ใน `.env.local` หรือใน Vercel Environment Variables:

```bash
DISCORD_ORDER_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-id/your-webhook-token
```

หลังตั้งค่าแล้ว เมื่อผู้ใช้กดยืนยันจัดส่งสินค้าในกระเป๋า ระบบจะส่ง Order ID, ผู้ใช้, รายการสินค้า, ผู้รับ, เบอร์โทร และที่อยู่จัดส่งเข้า Discord อัตโนมัติ
