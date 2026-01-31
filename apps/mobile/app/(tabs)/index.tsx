import { StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

import { Text, View, colors, textPresets, spacing, layout, borderRadius, componentStyles } from '@/shared';

const TabOneScreen = () => {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[textPresets.h1, { color: colors.text }]}>
        테마 시스템 테스트
      </Text>

      {/* 컬러 팔레트 */}
      <View style={styles.section}>
        <Text style={[textPresets.h3, { color: colors.text, marginBottom: spacing[3] }]}>
          컬러 팔레트
        </Text>
        <View style={styles.colorRow}>
          <View style={[styles.colorBox, { backgroundColor: colors.primary }]} />
          <View style={[styles.colorBox, { backgroundColor: colors.secondary }]} />
          <View style={[styles.colorBox, { backgroundColor: colors.success }]} />
          <View style={[styles.colorBox, { backgroundColor: colors.warning }]} />
          <View style={[styles.colorBox, { backgroundColor: colors.error }]} />
        </View>
      </View>

      {/* 타이포그래피 */}
      <View style={styles.section}>
        <Text style={[textPresets.h3, { color: colors.text, marginBottom: spacing[3] }]}>
          타이포그래피
        </Text>
        <Text style={[textPresets.h1, { color: colors.text }]}>H1 제목</Text>
        <Text style={[textPresets.h2, { color: colors.text }]}>H2 제목</Text>
        <Text style={[textPresets.h3, { color: colors.text }]}>H3 제목</Text>
        <Text style={[textPresets.body, { color: colors.text }]}>Body 본문 텍스트</Text>
        <Text style={[textPresets.caption, { color: colors.textSecondary }]}>Caption 캡션</Text>
      </View>

      {/* 버튼 스타일 */}
      <View style={styles.section}>
        <Text style={[textPresets.h3, { color: colors.text, marginBottom: spacing[3] }]}>
          버튼 스타일
        </Text>
        <TouchableOpacity style={componentStyles.button.primary}>
          <Text style={[textPresets.button, { color: colors.textInverse, textAlign: 'center' }]}>
            Primary 버튼
          </Text>
        </TouchableOpacity>
        <View style={{ height: spacing[2] }} />
        <TouchableOpacity style={componentStyles.button.secondary}>
          <Text style={[textPresets.button, { color: colors.text, textAlign: 'center' }]}>
            Secondary 버튼
          </Text>
        </TouchableOpacity>
        <View style={{ height: spacing[2] }} />
        <TouchableOpacity style={componentStyles.button.outline}>
          <Text style={[textPresets.button, { color: colors.text, textAlign: 'center' }]}>
            Outline 버튼
          </Text>
        </TouchableOpacity>
      </View>

      {/* 카드 스타일 */}
      <View style={styles.section}>
        <Text style={[textPresets.h3, { color: colors.text, marginBottom: spacing[3] }]}>
          카드 스타일
        </Text>
        <View style={componentStyles.card.default}>
          <Text style={[textPresets.body, { color: colors.text }]}>
            이것은 카드 컴포넌트 예시입니다.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: layout.screenPadding,
    paddingTop: 60,
    backgroundColor: colors.background,
  },
  section: {
    marginTop: layout.sectionGap,
  },
  colorRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  colorBox: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
  },
});

export default TabOneScreen;
