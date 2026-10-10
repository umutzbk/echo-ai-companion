import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, space, type } from './theme';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderSoft,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: space.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function GradientButton({
  label,
  onPress,
  loading,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable onPress={onPress} disabled={loading} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }, style]}>
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          {
            borderRadius: radius.md,
            paddingVertical: 15,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          },
          shadow(10),
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon && <Ionicons name={icon} size={18} color="#fff" />}
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15.5 }}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = 'ghost',
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'ghost' | 'danger' | 'solid';
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const tint = variant === 'danger' ? colors.danger : variant === 'solid' ? colors.accent : colors.text;
  const border = variant === 'danger' ? 'rgba(248,113,113,0.4)' : colors.border;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderRadius: radius.md,
          paddingVertical: 13,
          paddingHorizontal: space.lg,
          borderWidth: 1,
          borderColor: border,
          backgroundColor: variant === 'solid' ? colors.accentSoft : 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: pressed ? 0.6 : 1,
        },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={17} color={tint} />}
      <Text style={{ color: tint, fontWeight: '600', fontSize: 14.5 }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: radius.pill,
        paddingVertical: 9,
        paddingHorizontal: 14,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? colors.accentSoft : colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon && <Ionicons name={icon} size={14} color={active ? colors.accent : colors.textDim} />}
      <Text style={{ color: active ? colors.accent : colors.textDim, fontSize: 13.5, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[type.micro, { textTransform: 'uppercase', marginBottom: space.sm, marginTop: space.sm }, style]}>
      {children}
    </Text>
  );
}

const AVATAR_COLORS = ['#7C6CF0', '#F0726C', '#34D399', '#F59E0B', '#60A5FA', '#C16CF0'];

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.trim().slice(0, 2).toUpperCase();
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '33',
        borderWidth: 1,
        borderColor: color + '66',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color, fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

export function IconCircle({
  icon,
  color = colors.accent,
  size = 40,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '22',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}
