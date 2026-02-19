import React from 'react';
import { ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { ProfileStackParamList } from '../../types';
import TermsContent from '../../components/legal/TermsContent';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Terms'>;

const TermsScreen: React.FC<Props> = () => {
  const { theme } = useTheme();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <TermsContent />
    </ScrollView>
  );
};

export default TermsScreen;
