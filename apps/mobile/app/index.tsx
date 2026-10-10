import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listPersons, Person } from '../src/lib/store';
import { colors, space, type } from '../src/ui/theme';
import { Avatar, GradientButton, IconCircle } from '../src/ui/components';

export default function Home() {
  const [persons, setPersons] = useState<Person[]>([]);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      listPersons().then(setPersons);
    }, [])
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={persons}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 110 }}
        ListHeaderComponent={
          <View style={{ marginBottom: space.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={type.display}>People</Text>
              <Link href="/settings" asChild>
                <Pressable hitSlop={10}>
                  <IconCircle icon="settings-outline" color={colors.textDim} size={38} />
                </Pressable>
              </Link>
            </View>
            <Text style={[type.dim, { marginTop: 4 }]}>
              Add the people you talk to, import a chat, then reflect.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 70, paddingHorizontal: space.xl }}>
            <IconCircle icon="people-outline" size={72} color={colors.accent} />
            <Text style={[type.h2, { marginTop: space.lg }]}>No one here yet</Text>
            <Text style={[type.dim, { textAlign: 'center', marginTop: 6 }]}>
              Add someone — a friend, partner, manager — then import a conversation to start understanding it.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/person/${item.id}`)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              backgroundColor: colors.surface,
              borderColor: colors.borderSoft,
              borderWidth: 1,
              borderRadius: 18,
              padding: 14,
              marginBottom: 10,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Avatar name={item.name} />
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>{item.name}</Text>
              <Text style={[type.small, { textTransform: 'capitalize', marginTop: 2 }]}>
                {item.relationshipType}
                {item.notes ? ` · ${item.notes}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMute} />
          </Pressable>
        )}
      />
      <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: 28 }}>
        <GradientButton label="Add person" icon="add" onPress={() => router.push('/person/add')} />
      </View>
    </View>
  );
}
