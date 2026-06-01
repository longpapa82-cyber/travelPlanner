# 불변식: Android/UI (#30~34)

30. **Android KAV 금지**: `KeyboardAvoidingView behavior="height"` 금지. `enabled={Platform.OS === 'ios'}`.
31. **Animated cleanup 필수**: unmount 시 `stopAnimation()` cleanup useEffect 필수.
32. **useFocusEffect for screen reset**: tab-nested Native Stack에서 `navigation.addListener('focus')` 대신 `useFocusEffect`.
33. **Single source of truth for paired state**: 관련 상태 쌍은 단일 setter로만 업데이트.
34. **Android 키보드 인셋은 manual Keyboard listener**: `Keyboard.addListener('keyboardDidShow/Hide')` → ScrollView paddingBottom 동적 보정.
