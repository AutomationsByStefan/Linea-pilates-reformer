# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  phone: '+387 61 123 456',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
db.memberships.insertOne({
  id: 'mem_' + Date.now(),
  user_id: userId,
  naziv: 'Mjesečna članarina',
  tip: 'aktivna',
  preostali_termini: 8,
  ukupni_termini: 12,
  datum_isteka: new Date(Date.now() + 25*24*60*60*1000),
  created_at: new Date()
});
db.trainings.insertOne({
  id: 'train_' + Date.now(),
  user_id: userId,
  datum: new Date(Date.now() + 2*24*60*60*1000),
  vrijeme: '10:00',
  instruktor: 'Ana Marić',
  tip: 'predstojeći',
  trajanje: 50,
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend API
```bash
# Test auth endpoint with session token
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

curl -X GET "$API_URL/api/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test memberships
curl -X GET "$API_URL/api/memberships" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test trainings
curl -X GET "$API_URL/api/trainings/upcoming" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test public endpoints
curl -X GET "$API_URL/api/packages"
curl -X GET "$API_URL/api/schedule"
curl -X GET "$API_URL/api/studio-info"
```

## Step 3: Browser Testing
```python
# Set cookie and navigate
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "pilates-hub-12.preview.emergentagent.com",
    "path": "/",
    "httpOnly": True,
    "secure": True,
    "sameSite": "None"
}])
await page.goto("https://pilates-hub-12.preview.emergentagent.com")
```

## Quick Debug
```bash
# Check data format
mongosh --eval "
use('test_database');
db.users.find().limit(2).pretty();
db.user_sessions.find().limit(2).pretty();
db.memberships.find().limit(2).pretty();
db.trainings.find().limit(2).pretty();
"

# Clean test data
mongosh --eval "
use('test_database');
db.users.deleteMany({email: /test\.user\./});
db.user_sessions.deleteMany({session_token: /test_session/});
"
```

## Checklist
- [ ] User document has user_id field
- [ ] Session user_id matches user's user_id
- [ ] All queries use `{"_id": 0}` projection
- [ ] API returns user data (not 401/404)
- [ ] Browser loads dashboard (not login page)

## Success Indicators
✅ /api/auth/me returns user data
✅ Dashboard loads without redirect
✅ CRUD operations work
✅ Bottom navigation works
✅ All pages load correctly

## Failure Indicators
❌ "User not found" errors
❌ 401 Unauthorized responses
❌ Redirect to login page
