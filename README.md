# Gacha Pop

เว็บ Gacha Pop โทน Pastel Purple / Kawaii สร้างด้วย Next.js App Router, TypeScript และ Tailwind CSS

## Run Local

```bash
npm install
npm run dev
```

เปิดเว็บที่ `http://localhost:3000`

## Database

ระบบข้อมูลหลักใช้ Supabase เป็นฐานข้อมูลถาวรสำหรับ user, coin, product, stock, inventory, order, popup ads และ admin settings

1. สร้าง Supabase project
2. เปิด SQL Editor แล้วรัน migration `supabase/migrations/20260613_supabase_persistence.sql`
3. ตั้งค่า environment variables ตาม `.env.example`
4. Deploy บน Vercel แล้วเพิ่ม env ชุดเดียวกันใน Project Settings

## Required Environment Variables

```bash
SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_SECRET_KEY=your-supabase-secret-key
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
NEXT_PUBLIC_SITE_URL=https://your-domain.com
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-id/your-webhook-token
SHIPPING_LABEL_FONT_PATH=
```

## Deploy บน Vercel

1. Import repo จาก GitHub เข้า Vercel
2. ตั้งค่า env จาก `.env.example`
3. ใช้ build command:

```bash
npm run build
```

4. กด Deploy

## Discord Order Webhook

เมื่อผู้ใช้ยืนยันจัดส่ง ระบบจะสร้าง order, สร้าง PDF จ่าหน้าพัสดุ และส่งแจ้งเตือนไป Discord ผ่าน env:

```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-id/your-webhook-token
```

ห้ามใส่ webhook URL ตรงในโค้ด เพื่อให้ปลอดภัยบน GitHub และ Vercel
