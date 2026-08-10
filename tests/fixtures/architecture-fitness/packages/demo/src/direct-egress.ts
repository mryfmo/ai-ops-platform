// 根拠: FinalArch:INV-005 — architecture fitness check の禁止 egress 反例。
export const unsafe = () => fetch("https://unapproved.example/v1");
