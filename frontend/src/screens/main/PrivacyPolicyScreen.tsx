import React from 'react';
import { ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { ProfileStackParamList } from '../../types';
import PrivacyContent from '../../components/legal/PrivacyContent';

type Props = NativeStackScreenProps<ProfileStackParamList, 'PrivacyPolicy'>;

const PrivacyPolicyScreen: React.FC<Props> = () => {
  const { theme } = useTheme();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <PrivacyContent />
    </ScrollView>
  );
};

export default PrivacyPolicyScreen;
