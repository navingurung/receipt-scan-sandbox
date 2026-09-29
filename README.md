# Receipt Scan Sandbox（SAMURAI TAX）

レシート画像（カメラ / アップロード）を Veryfi API で読み取り、免税品の明細確認 → 最終確認までを試すサンドボックス。

## セットアップ

```bash
npm install
cp .env.example .env.local   # Veryfi の Client ID / Username / API Key を設定
npm run dev
```

http://localhost:3000 を開く（カメラは localhost または HTTPS でのみ動作）。

## 構成

- `app/api/receipt-scan/route.ts` — 画像を受け取り Veryfi に送信（API キーはサーバー側のみ）
- `lib/receipt-mapper.ts` — Veryfi JSON → 明細（内税/外税判定、軽減税率マーク判定）
- `lib/receipt-calc.ts` — 小計・消費税・税率別内訳・値引按分
- `components/receipt-scanner.tsx` — 全画面スキャナー（自動撮影 + 手動撮影）
- `components/steps/*` — 読み取り → 免税品 → 最終確認
