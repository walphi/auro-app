# 🧪 Property Listings Testing Guide

## ✅ Step 1: Database Schema Created
**Status**: ✓ COMPLETED
- `property_listings` table created
- `search_property_listings()` function created
- Indexes and RLS policies in place

---

## 📝 Step 2: Insert Test Data

Run this in **Supabase SQL Editor**:

1. Open the file: `sql/test_listings_data.sql`
2. Copy all contents
3. Paste in Supabase SQL Editor
4. Click **"Run"**

This will insert **6 sample listings**:
- 4 properties in Dubai Marina (3 for sale, 1 for rent)
- 1 property in Downtown Dubai
- 1 property in JBR

**Expected Output**: 
```
total_listings: 6

community              | count
-----------------------|------
Dubai Marina           | 4
Downtown Dubai         | 1
Jumeirah Beach Residence | 1
```

---

## 🔍 Step 3: Test Search Function in Supabase

Run this in **Supabase SQL Editor**:

1. Open the file: `sql/test_search_queries.sql`
2. Run each query individually to verify results

**Expected Results**:
- Test 1 (Dubai Marina): 4 results
- Test 2 (2BR apartments): 3 results
- Test 3 (Under 3M AED): 3 results
- Test 4 (Penthouses in Marina): 1 result
- Test 5 (Rentals): 1 result
- Test 6 (Downtown): 1 result
- Test 7 (3BR, 3-7M): 2 results
- Test 8 (All listings): 6 results

---

## 💻 Step 4: Test Locally via Node.js

Run this in your terminal:

```bash
node test_listings_search.js
```

This will test the RPC function using your local environment variables.

**Expected Output**:
```
🔧 Testing Property Listings Search

Supabase URL: https://your-project.supabase.co
Using key: ✓ Found

📋 Test 1: Search Dubai Marina properties
──────────────────────────────────────────────────
✅ Found 3 results

1. Luxury 2BR Apartment with Marina View
   📍 Dubai Marina - Marina Gate
   🏠 2 BR | 2 BA | 1200 sqft
   💰 AED 2,500,000
...
```

---

## 📱 Step 5: Test via WhatsApp (Live Environment)

**Prerequisites**:
1. ✅ Database schema created (DONE)
2. ✅ Test data inserted (DO THIS NOW)
3. ⏳ Code deployed to Netlify (PR #3 needs to be merged)

**Once deployed**, send these WhatsApp messages to test:

### Test Message 1: Basic Search
```
What properties do you have in Dubai Marina?
```

**Expected Response**:
```
I found 3 properties that match your criteria:

1. *Spacious 3BR Penthouse - Marina Views*
   📍 Dubai Marina - The Torch
   🏠 3 BR | 4 BA | 2,500 sqft
   💰 AED 6,800,000
   🖼️ [image URL]

2. *Luxury 2BR Apartment with Marina View*
   📍 Dubai Marina - Marina Gate
   🏠 2 BR | 2 BA | 1,200 sqft
   💰 AED 2,500,000
   🖼️ [image URL]

3. *Modern 1BR Apartment - Affordable Marina Living*
   📍 Dubai Marina - Botanica
   🏠 1 BR | 1 BA | 750 sqft
   💰 AED 1,200,000
   🖼️ [image URL]

Would you like more details on any of these properties, or should I refine the search?
```

### Test Message 2: Filtered Search
```
Show me 2-bedroom apartments under 3 million AED
```

**Expected Response**: Should return 2 matching properties

### Test Message 3: Rental Search
```
Do you have any apartments for rent in Dubai Marina?
```

**Expected Response**: Should return 1 rental property

---

## 🐛 Troubleshooting

### If you get "no results" error:
1. Verify test data was inserted: `SELECT COUNT(*) FROM property_listings;`
2. Check if RPC function exists: `SELECT * FROM search_property_listings(p_limit := 1);`

### If you get RPC error:
1. Verify function was created: Check in Supabase Dashboard → Database → Functions
2. Re-run `sql/property_listings.sql` if needed

### If local test fails:
1. Check `.env.local` has correct Supabase credentials
2. Verify `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

---

## 🚀 Next Steps After Testing

1. **Merge PR #3** to deploy the code
2. **Set Netlify Environment Variables**:
   - `PARSEBOT_API_URL`
   - `PARSEBOT_API_KEY`
3. **Sync Real Data**: Call `/api/sync-listings` endpoint
4. **Monitor Logs**: Check Netlify function logs for any errors

---

## 📊 Current Status

- ✅ Database schema created
- ⏳ Test data insertion (DO THIS NOW)
- ⏳ Function testing in Supabase
- ⏳ Local testing via Node.js
- ⏳ WhatsApp testing (after deployment)
- ⏳ PR merge and deployment
- ⏳ Real data sync via ParseBot

**Next Action**: Run `sql/test_listings_data.sql` in Supabase SQL Editor
