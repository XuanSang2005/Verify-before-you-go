import { Alert, Platform } from 'react-native';

export async function requestChecklistResetConfirmation(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return window.confirm('Reset all five checklist items? This cannot be undone.');
  }

  return new Promise((resolve) => {
    Alert.alert(
      'Reset checklist?',
      'All five items will return to unchecked. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Reset', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
