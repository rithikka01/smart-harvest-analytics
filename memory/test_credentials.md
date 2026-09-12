# Test credentials

## Standard user (farmer role)
- Email: demo@farm.com
- Password: pass123
- Existing farm: "Green Valley Farm" (id df8042b5-cb29-43ce-8ac7-5c7d8f58e43d, Rice, Chennai)

## Notes
- Registration is open: POST /api/auth/register {email,password,name,role in farmer|individual|officer}
- Admin role cannot be self-assigned; set `role: "admin"` directly in Mongo `users` collection if needed.
