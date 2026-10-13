import ExpoQuickLook from '@magrinj/expo-quick-look';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addArtifacts, Artifact, artifactUri, deleteArtifact, loadArtifacts, PickedArtifact } from '../artifacts';
import { TileFilename } from '../components/TileFilename';
import { colors } from '../theme';

function fileLabel(artifact: Artifact): string {
  const extension = artifact.originalName.split('.').pop()?.toUpperCase();
  return extension && extension !== artifact.originalName.toUpperCase() ? extension.slice(0, 6) : 'FILE';
}

const MENU_WIDTH = 188;
const MENU_HEIGHT = 50;

function ArtifactTile({ artifact, size, onLongPress, onRemove, removing }: { artifact: Artifact; size: number; onLongPress: (x: number, y: number) => void; onRemove: () => void; removing: boolean }) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    if (artifact.type !== 'text' && artifact.type !== 'markdown') return;
    let active = true;
    const file = new File(artifactUri(artifact));
    if (file.size <= 256_000) {
      file.text()
        .then((contents) => {
          if (active) setTextPreview({ id: artifact.id, text: contents.replace(/\r\n?/g, '\n').trimStart().slice(0, 500) });
        })
        .catch(() => {});
    }
    return () => { active = false; };
  }, [artifact]);

  useEffect(() => {
    if (artifact.type === 'image' || artifact.type === 'text' || artifact.type === 'markdown') return;
    let active = true;
    ExpoQuickLook.generateThumbnail({ uri: artifactUri(artifact), size: { width: 180, height: 180 } })
      .then((result) => { if (active) setThumbnail(result.uri); })
      .catch(() => {});
    return () => { active = false; };
  }, [artifact]);

  const picture = artifact.type === 'image' ? artifactUri(artifact)
    : artifact.type === 'text' || artifact.type === 'markdown' ? null : thumbnail;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${artifact.originalName}`}
      accessibilityHint="Touch and hold for Remove item"
      accessibilityActions={[{ name: 'remove', label: 'Remove item' }]}
      onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'remove') onRemove(); }}
      disabled={removing}
      onPress={() => router.push({ pathname: '/artifact/[id]', params: { id: artifact.id } })}
      onLongPress={(event) => onLongPress(event.nativeEvent.pageX, event.nativeEvent.pageY)}
      style={[styles.tile, { width: size }]}
    >
      <View style={[styles.preview, { height: size }]}>
        {picture ? (
          <Image source={{ uri: picture }} style={styles.previewImage} contentFit="cover" />
        ) : artifact.type === 'text' || artifact.type === 'markdown' ? (
          <View style={styles.textPage}>
            <Text style={styles.textPageLabel} allowFontScaling={false}>{artifact.type === 'markdown' ? 'MARKDOWN' : 'TEXT'}</Text>
            <View style={styles.textPageRule} />
            {textPreview?.id === artifact.id && textPreview.text ? (
              <Text style={styles.textExcerpt} numberOfLines={4} allowFontScaling={false}>{textPreview.text}</Text>
            ) : (
              <View style={styles.textLines}>
                <View style={styles.textLine} />
                <View style={styles.textLine} />
                <View style={[styles.textLine, styles.shortTextLine]} />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.fileType}>{fileLabel(artifact)}</Text>
          </View>
        )}
      </View>
      <TileFilename key={`${artifact.id}-${size}`} name={artifact.originalName} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const tileSize = (width - 52) / 3;
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ item: Artifact; x: number; y: number } | null>(null);
  const pendingRemoval = useRef<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const reload = useCallback(async () => {
    try {
      setArtifacts(await loadArtifacts());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  async function saveSelection(selected: PickedArtifact[]) {
    if (!selected.length) return;
    setBusy(true);
    try {
      const result = await addArtifacts(selected);
      await reload();
      if (result.failed) Alert.alert('Some files could not be added', `${result.added} added, ${result.failed} failed.`);
    } catch {
      Alert.alert('Could not add files', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function addPhotos() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1 });
      if (result.canceled) return;
      await saveSelection(result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.fileName || `Photo.${asset.uri.split('.').pop()?.split('?')[0] || 'jpg'}`,
        mimeType: asset.mimeType ?? undefined,
        storedExtension: /\.([a-z0-9]{1,12})(?:\?|$)/i.exec(asset.uri)?.[1]?.toLowerCase(),
      })));
    } catch {
      Alert.alert('Could not open Photos', 'Please try again.');
    }
  }

  async function addFiles() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return;
      await saveSelection(result.assets.map((asset) => ({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType })));
    } catch {
      Alert.alert('Could not open Files', 'Please try again.');
    }
  }

  function showAddChoices() {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancel', 'Photos', 'Files'], cancelButtonIndex: 0 },
      (choice) => {
        if (choice === 1) void addPhotos();
        if (choice === 2) void addFiles();
      },
    );
  }

  function confirmRemove(item: Artifact) {
    if (removingId) return;
    Alert.alert('Remove item?', `“${item.originalName}” will be deleted from TinyElevator.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove item', style: 'destructive', onPress: () => {
          setRemovingId(item.id);
          void deleteArtifact(item.id)
            .then(reload)
            .catch(() => Alert.alert('Could not remove item', 'Please try again.'))
            .finally(() => setRemovingId(null));
        },
      },
    ]);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 14 }]}>
      {loading ? (
        <ActivityIndicator style={styles.center} color={colors.text} />
      ) : loadError ? (
        <Text style={styles.centerText}>The saved collection could not be read.</Text>
      ) : (
        <FlatList
          data={artifacts}
          numColumns={3}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 110 }]}
          ListEmptyComponent={<Text style={styles.empty}>No items yet</Text>}
          renderItem={({ item }) => (
            <ArtifactTile
              artifact={item}
              size={tileSize}
              onLongPress={(x, y) => setMenu({ item, x, y })}
              onRemove={() => confirmRemove(item)}
              removing={removingId !== null}
            />
          )}
        />
      )}
      <View style={[styles.footer, { bottom: insets.bottom + 16 }]}>
        <Pressable
          accessibilityRole="button"
          disabled={busy || loading || loadError}
          onPress={showAddChoices}
          style={[styles.addButton, busy && styles.disabled]}
        >
          <Text style={styles.addText}>{busy ? 'Adding…' : 'Add'}</Text>
        </Pressable>
        <Text style={styles.removeHint}>Long-press to remove item</Text>
      </View>
      <Modal
        transparent
        animationType="fade"
        visible={menu !== null}
        onRequestClose={() => setMenu(null)}
        onDismiss={() => {
          const item = pendingRemoval.current;
          pendingRemoval.current = null;
          if (item) confirmRemove(item);
        }}
      >
        <View style={styles.menuLayer}>
          <Pressable style={styles.menuBackdrop} onPress={() => setMenu(null)} accessibilityRole="button" accessibilityLabel="Dismiss item menu" />
          {menu && (
            <View style={[styles.contextMenu, {
              left: Math.max(16, Math.min(menu.x - MENU_WIDTH / 2, width - MENU_WIDTH - 16)),
              top: menu.y + MENU_HEIGHT + 14 <= height - insets.bottom - 16
                ? menu.y + 14
                : Math.max(insets.top + 16, menu.y - MENU_HEIGHT - 14),
            }]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  pendingRemoval.current = menu.item;
                  setMenu(null);
                }}
                style={styles.menuAction}
              >
                <Text style={styles.menuActionText}>Remove item</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  grid: { paddingHorizontal: 16, flexGrow: 1 },
  row: { gap: 10, marginBottom: 18 },
  tile: { alignItems: 'stretch' },
  preview: { backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  textPage: { flex: 1, padding: 10, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  textPageLabel: { color: '#315F99', fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  textPageRule: { height: 1, marginTop: 4, marginBottom: 5, backgroundColor: '#D7E0EC' },
  textExcerpt: { color: '#30415B', fontSize: 9, lineHeight: 11 },
  textLines: { gap: 5 },
  textLine: { height: 3, borderRadius: 2, backgroundColor: '#CAD4E2' },
  shortTextLine: { width: '68%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fileType: { fontSize: 16, fontWeight: '700', color: colors.fileType, letterSpacing: 0.5 },
  empty: { alignSelf: 'center', marginTop: 120, color: colors.muted, fontSize: 15 },
  center: { flex: 1 },
  centerText: { marginTop: 120, textAlign: 'center', color: colors.muted },
  footer: { position: 'absolute', alignSelf: 'center', alignItems: 'center' },
  addButton: { minWidth: 148, paddingVertical: 17, paddingHorizontal: 36, alignItems: 'center', backgroundColor: colors.accent, borderRadius: 30 },
  disabled: { opacity: 0.5 },
  addText: { color: colors.accentText, fontWeight: '700', fontSize: 16 },
  removeHint: { marginTop: 8, color: colors.muted, fontSize: 12 },
  menuLayer: { flex: 1 },
  menuBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.backdrop },
  contextMenu: { position: 'absolute', width: MENU_WIDTH, borderRadius: 14, backgroundColor: colors.surface, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  menuAction: { minHeight: MENU_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  menuActionText: { color: colors.danger, fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
