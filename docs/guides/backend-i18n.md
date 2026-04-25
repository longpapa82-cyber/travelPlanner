# Backend i18n Implementation Guide

## Problem Statement
Backend error messages were hardcoded in English, causing non-English users to receive error messages in English regardless of their language settings.

## Solution Implemented

### 1. i18n Infrastructure (Already Existed)
- **Location**: `/backend/src/common/i18n.ts`
- **Functions**:
  - `t(key: string, lang: SupportedLang)` - Translate a key to specified language
  - `parseLang(acceptLanguage?: string)` - Parse Accept-Language header
- **Languages Supported**: 17 languages (ko, en, ja, zh, es, de, fr, th, vi, pt, ar, id, hi, it, ru, tr, ms)

### 2. Changes Made

#### a. Added Translation Keys (i18n.ts)
Added the following translation keys for common error messages:
- `auth.registration.failed` - Registration failure message
- `auth.invalid.credentials` - Invalid login credentials
- `auth.invalid.refreshToken` - Invalid refresh token
- `auth.refreshToken.revoked` - Refresh token revoked
- `auth.account.locked` - Account locked due to too many attempts
- `auth.2fa.alreadyEnabled` - 2FA already enabled
- `auth.2fa.notEnabled` - 2FA not enabled
- `auth.2fa.setupFirst` - Setup 2FA first
- `auth.2fa.invalidCode` - Invalid 2FA code
- `trip.notFound` - Trip not found
- `trip.deleteOwnerOnly` - Only owner can delete trip
- `user.notFound` - User not found

#### b. Updated auth.service.ts
- Imported `SupportedLang` type from i18n module
- Added `lang` parameter to methods:
  - `register(registerDto, lang)`
  - `login(loginDto, userAgent, lang)`
- Replaced hardcoded messages with `t()` function calls:
  ```typescript
  // Before
  throw new BadRequestException('Registration failed. Please check your information and try again.');

  // After
  throw new BadRequestException(t('auth.registration.failed', lang));
  ```

#### c. Updated auth.controller.ts
- Added `@Headers('accept-language')` decorator to capture language preference
- Pass parsed language to service methods:
  ```typescript
  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.authService.register(registerDto, parseLang(acceptLanguage));
  }
  ```

### 3. Testing
Created test script `/backend/test-i18n.js` to verify:
- Registration error messages in different languages
- Login error messages in different languages

## Remaining Work

### High Priority (User-Facing Errors)

#### 1. Update More Auth Service Methods
- [ ] `refreshToken()` - Add lang parameter
- [ ] `validateUser()` - Add lang parameter
- [ ] `verifyTwoFactor()` - Add lang parameter
- [ ] `forgotPassword()` - Add lang parameter
- [ ] `resetPassword()` - Add lang parameter

#### 2. Update trips.service.ts
All trip-related error messages need i18n:
- [ ] "Trip not found"
- [ ] "Only the trip owner can delete this trip"
- [ ] "Itinerary not found"
- [ ] "Activity not found at the specified index"
- [ ] "Order array must contain unique indices"
- [ ] "This share link has expired"
- [ ] Collaborator-related messages

#### 3. Update Controllers to Pass Language
- [ ] trips.controller.ts - Add Accept-Language header parsing
- [ ] users.controller.ts - Add Accept-Language header parsing
- [ ] subscription.controller.ts - Add Accept-Language header parsing
- [ ] admin controllers - Add Accept-Language header parsing

### Medium Priority

#### 4. Handle Guards and Strategies
Guards and strategies don't have direct access to headers. Options:
- Use error codes that frontend can translate
- Extract language from JWT token (store during login)
- Use request context injection

Current guards needing update:
- [ ] admin.guard.ts - "Admin access required"
- [ ] premium.guard.ts - "Premium subscription required"
- [ ] email-verified.guard.ts - "Email verification required"
- [ ] jwt.strategy.ts - "User not found"
- [ ] local.strategy.ts - "Invalid credentials"

#### 5. Add More Translation Keys
Remaining error messages to translate:
- [ ] "Cannot add yourself as a collaborator"
- [ ] "Cannot follow yourself"
- [ ] "Cannot like a private trip"
- [ ] "Expense not found"
- [ ] "This split is already settled"
- [ ] "Announcement not found"
- [ ] Webhook-related errors
- [ ] Image upload errors

### Low Priority

#### 6. Centralized Error Handling
Consider creating a centralized error handler that:
- Automatically detects language from request context
- Provides fallback to English if translation missing
- Logs untranslated error keys for tracking

#### 7. Dynamic Language Loading
For scalability, consider:
- Loading translations from database
- Admin interface to manage translations
- Real-time translation updates without deployment

## Usage Examples

### Controller
```typescript
@Post('some-endpoint')
async someMethod(
  @Body() dto: SomeDto,
  @Headers('accept-language') acceptLanguage?: string,
) {
  const lang = parseLang(acceptLanguage);
  return this.service.someMethod(dto, lang);
}
```

### Service
```typescript
async someMethod(dto: SomeDto, lang: SupportedLang = 'ko') {
  if (someError) {
    throw new BadRequestException(t('error.key', lang));
  }
}
```

### Adding New Translation
1. Add key to `/backend/src/common/i18n.ts`:
```typescript
'error.newKey': {
  ko: '한국어 에러 메시지',
  en: 'English error message',
  // ... other languages
}
```

2. Use in service:
```typescript
throw new SomeException(t('error.newKey', lang));
```

## Testing Checklist

- [ ] Test registration with duplicate email in Korean/English
- [ ] Test login with wrong password in Korean/English
- [ ] Test API endpoints with different Accept-Language headers
- [ ] Test missing language header (should default to Korean)
- [ ] Test unsupported language (should fallback to Korean)

## Notes

1. **Frontend Already Sends Language**: Frontend is already configured to send `Accept-Language` header with every request based on user's language setting.

2. **Gradual Migration**: Not all errors need immediate translation. Focus on user-facing errors first.

3. **Consistency**: Always use the same error message for the same error condition across languages.

4. **Security**: Some errors intentionally use generic messages to prevent information disclosure (e.g., "Registration failed" instead of "Email already exists").

## References

- Frontend i18n: `/frontend/src/i18n/`
- Backend i18n: `/backend/src/common/i18n.ts`
- Test script: `/backend/test-i18n.js`