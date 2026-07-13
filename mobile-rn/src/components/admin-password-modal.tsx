import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { adminPasswordEmitter } from '../lib/admin-password-emitter';
import { useTheme } from '../features/theme';
import type { AppColors } from '../theme/colors';

export function AdminPasswordModal() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const resolveRef = useRef<((v: string | null) => void) | null>(null);

  useEffect(() => {
    return adminPasswordEmitter.subscribe(({ message: msg, resolve }) => {
      setMessage(msg);
      setPassword('');
      resolveRef.current = resolve;
      setVisible(true);
    });
  }, []);

  function confirm() {
    setVisible(false);
    resolveRef.current?.(password);
    resolveRef.current = null;
  }

  function cancel() {
    setVisible(false);
    resolveRef.current?.(null);
    resolveRef.current = null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <Pressable style={styles.overlay} onPress={cancel}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.box} onPress={() => {}}>
            <Text style={styles.title}>Admin şifresi</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <TextInput
              style={styles.input}
              placeholder="Şifre"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoFocus
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={confirm}
              returnKeyType="done"
            />
            <View style={styles.buttons}>
              <Pressable style={styles.btnCancel} onPress={cancel}>
                <Text style={styles.btnCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable style={styles.btnConfirm} onPress={confirm}>
                <Text style={styles.btnConfirmText}>Onayla</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    box: {
      backgroundColor: colors.panel,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      width: '100%',
      maxWidth: 360,
      gap: 12,
    },
    title: { color: colors.text, fontSize: 17, fontWeight: '700' },
    message: { color: colors.muted, fontSize: 14 },
    input: {
      backgroundColor: colors.backgroundTop,
      borderWidth: 1,
      borderColor: 'rgba(124,92,255,0.4)',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 15,
    },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
    btnCancel: { paddingHorizontal: 16, paddingVertical: 8 },
    btnCancelText: { color: colors.muted, fontSize: 15 },
    btnConfirm: {
      backgroundColor: colors.accent,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    btnConfirmText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  });
}
