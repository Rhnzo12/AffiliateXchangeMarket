# How to Get/Set Niches in Creator Profile

Creator niches are stored as an array of strings in the `creator_profiles` table. These niches are used by the recommendation algorithm to match offers to creators.

---

## Method 1: Via API (Recommended)

### View Your Current Niches

```bash
# Login first
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","password":"your_password"}' \
  -c cookies.txt

# Get your profile (includes niches)
curl -X GET http://localhost:5000/api/profile \
  -b cookies.txt | jq '.creatorProfile.niches'
```

**Example Response:**
```json
["Gaming", "Tech", "Reviews"]
```

### Update Your Niches

```bash
# Update niches via PUT request
curl -X PUT http://localhost:5000/api/profile \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "niches": ["Fitness", "Health", "Wellness"]
  }' | jq
```

**Example Response:**
```json
{
  "id": "user-uuid",
  "userId": "user-uuid",
  "bio": "Fitness content creator",
  "niches": ["Fitness", "Health", "Wellness"],
  "youtubeUrl": "https://youtube.com/@yourhandle",
  ...
}
```

---

## Method 2: Via Web UI

### Step 1: Login to the Application

1. Open browser: `http://localhost:5000`
2. Login as a creator

### Step 2: Go to Settings

1. Click on **Settings** in the sidebar
2. Or navigate to `http://localhost:5000/settings`

### Step 3: Update Your Profile

In the Settings page, you'll find the **Content Niches** field in the Profile Information section:
- Located right after the Bio field
- Enter your niches as comma-separated values
- Examples are provided below the field

Enter your niches like this:
```
Gaming, Tech, Reviews, Tutorials
```

Click **Save Changes** button at the bottom of the form.

**Note:** The niches field is only visible for creator accounts, not company or admin accounts.

---

## Method 3: Direct SQL (For Testing/Development)

### View Current Niches

```sql
-- Find your creator profile
SELECT cp.niches, u.username, u.email
FROM creator_profiles cp
JOIN users u ON cp.user_id = u.id
WHERE u.username = 'your_username';
```

### Update Niches Directly

```sql
-- Update niches for a specific user
UPDATE creator_profiles
SET niches = ARRAY['Fitness', 'Health', 'Wellness', 'Nutrition']
WHERE user_id = (
  SELECT id FROM users WHERE username = 'your_username'
);
```

### Verify Update

```sql
-- Check the updated niches
SELECT u.username, cp.niches
FROM creator_profiles cp
JOIN users u ON cp.user_id = u.id
WHERE u.username = 'your_username';
```

---

## Method 4: Using the Test Script

I've created a handy script to set niches quickly:

```bash
# Save this as set-niches.sh
chmod +x set-niches.sh
./set-niches.sh your_username your_password "Gaming,Tech,Reviews"
```

---

## Common Niche Categories

Here are popular niches you can use:

### Content Categories
- **Gaming** - Video games, streaming, esports
- **Tech** - Gadgets, software, reviews
- **Lifestyle** - Daily vlogs, fashion, home decor
- **Fitness** - Workouts, nutrition, wellness
- **Beauty** - Makeup, skincare, hair care
- **Food** - Cooking, recipes, restaurant reviews
- **Travel** - Destinations, tips, vlogs
- **Education** - Tutorials, how-tos, courses
- **Entertainment** - Comedy, sketches, reactions
- **Music** - Covers, original songs, reviews
- **Business** - Entrepreneurship, productivity, finance
- **Health** - Mental health, medical info, wellness

### Specific Niches
- Reviews
- Unboxing
- Tutorials
- Vlogs
- Commentary
- Challenges
- Product Demos
- Tips & Tricks

---

## Niche Format Requirements

### ✅ Valid Formats

```json
// Array of strings
["Gaming", "Tech", "Reviews"]

// Single niche
["Fitness"]

// Multiple niches
["Beauty", "Fashion", "Lifestyle", "Travel"]

// Empty array (no niches)
[]
```

### ❌ Invalid Formats

```json
// Don't use single string
"Gaming, Tech, Reviews"  // ❌ Wrong

// Don't use numbers
[1, 2, 3]  // ❌ Wrong

// Don't use objects
[{"name": "Gaming"}]  // ❌ Wrong
```

### Best Practices

1. **Use Title Case**: "Gaming" not "gaming"
2. **Be Specific**: "Tech Reviews" is better than just "Tech"
3. **Limit to 3-5**: Focus on your main content areas
4. **Match Offer Niches**: Use similar terms to offers in the platform
5. **Keep it Simple**: One or two words per niche

---

## Quick Setup Script

Create `set-niches.sh`:

```bash
#!/bin/bash

USERNAME="${1}"
PASSWORD="${2}"
NICHES="${3}"
BASE_URL="${BASE_URL:-http://localhost:5000}"

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ] || [ -z "$NICHES" ]; then
  echo "Usage: $0 <username> <password> <niches>"
  echo "Example: $0 creator1 password123 'Gaming,Tech,Reviews'"
  exit 1
fi

# Convert comma-separated string to JSON array
IFS=',' read -ra NICHE_ARRAY <<< "$NICHES"
JSON_NICHES="["
for i in "${!NICHE_ARRAY[@]}"; do
  NICHE=$(echo "${NICHE_ARRAY[$i]}" | xargs)  # Trim whitespace
  if [ $i -gt 0 ]; then
    JSON_NICHES+=","
  fi
  JSON_NICHES+="\"$NICHE\""
done
JSON_NICHES+="]"

echo "🔧 Setting niches for user: $USERNAME"
echo "📋 Niches: $JSON_NICHES"
echo ""

# Login
echo "📝 Logging in..."
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
  -c temp_cookies.txt > /dev/null

# Update profile with niches
echo "🔄 Updating niches..."
RESPONSE=$(curl -s -X PUT "$BASE_URL/api/profile" \
  -b temp_cookies.txt \
  -H "Content-Type: application/json" \
  -d "{\"niches\":$JSON_NICHES}")

echo "$RESPONSE" | jq -r '.creatorProfile.niches // .niches' > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Niches updated successfully!"
  echo ""
  echo "Current niches:"
  echo "$RESPONSE" | jq -r '.creatorProfile.niches // .niches'
else
  echo "❌ Failed to update niches"
  echo "$RESPONSE"
fi

# Cleanup
rm -f temp_cookies.txt
```

**Usage:**
```bash
chmod +x set-niches.sh
./set-niches.sh creator1 password "Gaming,Tech,Reviews"
```

---

## Testing Recommendations After Setting Niches

Once you've set your niches, test the recommendations:

```bash
# Get recommendations
curl -X GET http://localhost:5000/api/offers/recommended \
  -b cookies.txt | jq '.[].primaryNiche'
```

You should see offers that match your niches!

---

## Troubleshooting

### "niches is undefined" or null

**Cause:** Creator profile doesn't exist yet.

**Solution:**
```bash
# Just update any field to create the profile
curl -X PUT http://localhost:5000/api/profile \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"bio":"Content creator"}' | jq
```

### Niches not appearing in recommendations

**Causes:**
1. No approved offers matching your niches
2. You've already applied to all matching offers
3. Niche names don't match (e.g., "Gaming" vs "Games")

**Solution:**
```sql
-- Check available offer niches
SELECT DISTINCT primary_niche
FROM offers
WHERE status = 'approved'
ORDER BY primary_niche;

-- Update your niches to match
UPDATE creator_profiles
SET niches = ARRAY['Exact', 'Niche', 'Names', 'From', 'Above']
WHERE user_id = (SELECT id FROM users WHERE username = 'your_username');
```

### Empty recommendations array

**Check:**
1. Are niches set? `GET /api/profile`
2. Are there approved offers? Check database
3. Have you applied to everything? `GET /api/applications`

---

## API Reference

### GET /api/profile
**Authentication:** Required
**Returns:** User profile with `creatorProfile.niches`

### PUT /api/profile
**Authentication:** Required
**Body:**
```json
{
  "niches": ["Gaming", "Tech"],
  "bio": "Optional bio",
  "youtubeUrl": "Optional URL",
  "tiktokUrl": "Optional URL",
  "instagramUrl": "Optional URL",
  "youtubeFollowers": 0,
  "tiktokFollowers": 0,
  "instagramFollowers": 0
}
```

**Returns:** Updated profile with new niches

---

## Quick Reference

```bash
# 1. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"pass"}' -c cookies.txt

# 2. View niches
curl -X GET http://localhost:5000/api/profile -b cookies.txt | jq '.creatorProfile.niches'

# 3. Set niches
curl -X PUT http://localhost:5000/api/profile -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"niches":["Gaming","Tech","Reviews"]}' | jq

# 4. Test recommendations
curl -X GET http://localhost:5000/api/offers/recommended -b cookies.txt | jq
```

Done! 🎉
