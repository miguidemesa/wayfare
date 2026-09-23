import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { addDocumentNote, deleteDocument, fetchDocuments } from "@/shared/api";
import { fmtDate, TABULAR_NUMS, TRAVEL_THEME } from "@/shared/theme";
import type { DocumentFile } from "@/shared/types";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SheetHandle } from "@/components/GlassView";

const DOC_KINDS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; sensitive: boolean }[] = [
  { key: "PASSPORT_NOTE", label: "Passport & ID", icon: "card-outline", sensitive: true },
  { key: "TICKET", label: "Tickets & Passes", icon: "ticket-outline", sensitive: false },
  { key: "HOTEL", label: "Stay Voucher", icon: "bed-outline", sensitive: false },
  { key: "INSURANCE", label: "Insurance", icon: "shield-checkmark-outline", sensitive: true },
  { key: "NOTE", label: "Vault Note", icon: "document-text-outline", sensitive: false },
  { key: "OTHER", label: "Other Doc", icon: "folder-outline", sensitive: false },
];

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

export default function DocumentsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unmaskedIds, setUnmaskedIds] = useState<Record<string, boolean>>({});
  const [filterKind, setFilterKind] = useState<string>("ALL");

  // Add Doc Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("PASSPORT_NOTE");
  const [content, setContent] = useState("");
  const [sensitive, setSensitive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchDocuments(tripId);
      setDocuments(res.documents);
    } catch {} finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleMask(id: string) {
    setUnmaskedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleDelete(id: string, docName: string) {
    Alert.alert("Remove Document", `Remove "${docName}" from your vault?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setDocuments((prev) => prev.filter((d) => d.id !== id));
          try {
            await deleteDocument(tripId, id);
          } catch {
            void load();
          }
        },
      },
    ]);
  }

  async function handleAddDoc() {
    if (!name.trim() || !content.trim()) {
      Alert.alert("Required Fields", "Please enter a document name and details/number.");
      return;
    }
    setSaving(true);
    try {
      const res = await addDocumentNote(tripId, {
        name: name.trim(),
        kind,
        content: content.trim(),
        sensitive,
      });
      setDocuments((prev) => [res.document, ...prev]);
      setModalVisible(false);
      setName("");
      setContent("");
    } catch {
      Alert.alert("Error", "Could not save document.");
    } finally {
      setSaving(false);
    }
  }

  const filteredDocs =
    filterKind === "ALL" ? documents : documents.filter((d) => d.kind === filterKind);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Editorial Header */}
      <Header
        eyebrow="TRAVEL WALLET"
        title="Encrypted Vault"
        rightAction={
          <Button
            label="Add Document"
            iconLeft={<Ionicons name="add" size={16} color="#FFFFFF" />}
            variant="primary"
            size="sm"
            onPress={() => setModalVisible(true)}
          />
        }
      />

      {/* Filter Tabs */}
      <View style={styles.filterStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            onPress={() => setFilterKind("ALL")}
            style={[styles.filterChip, filterKind === "ALL" && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filterKind === "ALL" && styles.filterTextActive]}>
              All ({documents.length})
            </Text>
          </TouchableOpacity>
          {DOC_KINDS.map((k) => (
            <TouchableOpacity
              key={k.key}
              onPress={() => setFilterKind(k.key)}
              style={[styles.filterChip, filterKind === k.key && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filterKind === k.key && styles.filterTextActive]}>
                {k.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={TRAVEL_THEME.colors.terracotta} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={TRAVEL_THEME.colors.terracotta}
            />
          }
        >
          {filteredDocs.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="wallet-outline" size={44} color={TRAVEL_THEME.colors.terracotta} />}
              title="Travel Wallet is empty"
              description="Save quick reference notes for boarding passes, hotel vouchers, passport details, and travel insurance."
              actionLabel="+ Add Document"
              onAction={() => setModalVisible(true)}
            />
          ) : (
            <View style={styles.docsList}>
              {filteredDocs.map((doc) => {
                const meta = getDocMeta(doc.kind);
                const isMasked = doc.sensitive && !unmaskedIds[doc.id];
                const displayContent = isMasked
                  ? "•••• •••• •••• ••••"
                  : doc.content || "No text content stored.";

                return (
                  <Card key={doc.id} padding={16} style={styles.docCard}>
                    {/* Header Row */}
                    <View style={styles.docHeaderRow}>
                      <View style={styles.docHeaderLeft}>
                        <View style={[styles.docIconBubble, { backgroundColor: meta.bgColor }]}>
                          <Ionicons name={meta.icon} size={15} color={meta.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.docName} numberOfLines={1}>
                            {doc.name}
                          </Text>
                          <Text style={styles.docDate}>
                            Added {fmtDate(doc.createdAt)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.docHeaderRight}>
                        <Badge label={meta.label} variant={meta.badgeVariant} size="sm" />
                        <TouchableOpacity
                          onPress={() => handleDelete(doc.id, doc.name)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={15} color={TRAVEL_THEME.colors.inkDim} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Secret / Document Content Area */}
                    <View style={styles.docContentBox}>
                      <View style={styles.contentHeaderRow}>
                        <Text style={styles.contentLabel}>
                          {doc.sensitive ? "SECURE TRAVEL DATA" : "DETAILS & REFERENCE"}
                        </Text>
                        {doc.sensitive && (
                          <TouchableOpacity
                            onPress={() => toggleMask(doc.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={styles.revealBtn}
                          >
                            <Ionicons
                              name={isMasked ? "eye-outline" : "eye-off-outline"}
                              size={14}
                              color={TRAVEL_THEME.colors.terracotta}
                            />
                            <Text style={styles.revealText}>
                              {isMasked ? "Reveal" : "Hide"}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <Text
                        style={[
                          styles.contentText,
                          isMasked && styles.contentMaskedText,
                          TABULAR_NUMS,
                        ]}
                        selectable={!isMasked}
                      >
                        {displayContent}
                      </Text>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Floating Bottom Nav */}
      <BottomNav tripId={tripId} activeTab="wallet" accentColor={TRAVEL_THEME.colors.terracotta} />

      {/* Add Document Modal Bottom Sheet */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <SheetHandle />

            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add to Travel Wallet</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={TRAVEL_THEME.colors.inkMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Kind Picker */}
              <Text style={styles.fieldLabel}>DOCUMENT TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kindScroll}>
                <View style={styles.kindRow}>
                  {DOC_KINDS.map((k) => {
                    const active = kind === k.key;
                    return (
                      <TouchableOpacity
                        key={k.key}
                        onPress={() => {
                          setKind(k.key);
                          setSensitive(k.sensitive);
                        }}
                        style={[
                          styles.kindChip,
                          active && styles.kindChipActive,
                        ]}
                      >
                        <Ionicons
                          name={k.icon}
                          size={13}
                          color={active ? TRAVEL_THEME.colors.terracottaDark : TRAVEL_THEME.colors.inkSecondary}
                        />
                        <Text
                          style={[
                            styles.kindChipText,
                            active && styles.kindChipTextActive,
                          ]}
                        >
                          {k.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Document Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>DOCUMENT TITLE</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Passport, Tokyo Hotel Booking, ANA Flight Ticket"
                  placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                  style={styles.input}
                />
              </View>

              {/* Document Content / Number */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>DOCUMENT DETAILS / NUMBER / NOTES</Text>
                <TextInput
                  value={content}
                  onChangeText={setContent}
                  placeholder="e.g. Booking Code: #WFR-9821, Seat: 14A, Terminal 3"
                  placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                  multiline
                  numberOfLines={3}
                  style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
                />
              </View>

              {/* Sensitive Toggle */}
              <TouchableOpacity
                onPress={() => setSensitive((s) => !s)}
                activeOpacity={0.8}
                style={styles.sensitiveToggleRow}
              >
                <Ionicons
                  name={sensitive ? "shield-checkmark" : "shield-outline"}
                  size={18}
                  color={sensitive ? TRAVEL_THEME.colors.forest : TRAVEL_THEME.colors.inkMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sensitiveTitle}>Mask Sensitive Information</Text>
                  <Text style={styles.sensitiveSubtitle}>
                    Hides content by default until you tap Reveal.
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>

            <Button
              label="Save to Vault"
              variant="primary"
              size="lg"
              loading={saving}
              onPress={handleAddDoc}
              style={{ marginTop: 14 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function getDocMeta(kind: string): {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  badgeVariant: "terracotta" | "forest" | "ocean" | "amber" | "neutral";
} {
  switch (kind) {
    case "PASSPORT_NOTE":
      return {
        label: "Passport & ID",
        icon: "card-outline",
        color: TRAVEL_THEME.colors.oceanDark,
        bgColor: TRAVEL_THEME.colors.oceanLight,
        badgeVariant: "ocean",
      };
    case "TICKET":
      return {
        label: "Ticket",
        icon: "ticket-outline",
        color: TRAVEL_THEME.colors.terracotta,
        bgColor: TRAVEL_THEME.colors.terracottaLight,
        badgeVariant: "terracotta",
      };
    case "HOTEL":
      return {
        label: "Stay Voucher",
        icon: "bed-outline",
        color: TRAVEL_THEME.colors.amberDark,
        bgColor: TRAVEL_THEME.colors.amberLight,
        badgeVariant: "amber",
      };
    case "INSURANCE":
      return {
        label: "Insurance",
        icon: "shield-checkmark-outline",
        color: TRAVEL_THEME.colors.forestDark,
        bgColor: TRAVEL_THEME.colors.forestLight,
        badgeVariant: "forest",
      };
    case "NOTE":
    default:
      return {
        label: "Vault Note",
        icon: "document-text-outline",
        color: TRAVEL_THEME.colors.inkSecondary,
        bgColor: TRAVEL_THEME.colors.surfaceWarm,
        badgeVariant: "neutral",
      };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TRAVEL_THEME.colors.bg,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TRAVEL_THEME.colors.bg,
  },
  filterStrip: {
    backgroundColor: TRAVEL_THEME.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: TRAVEL_THEME.colors.border,
    paddingVertical: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 7,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  filterChipActive: {
    backgroundColor: TRAVEL_THEME.colors.terracottaLight,
    borderColor: "#F0D7D0",
  },
  filterText: {
    fontSize: 12,
    fontWeight: "500",
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  filterTextActive: {
    fontWeight: "700",
    color: TRAVEL_THEME.colors.terracottaDark,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
  },
  docsList: {
    gap: 12,
  },
  docCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
    ...TRAVEL_THEME.shadows.card,
  },
  docHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  docHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  docIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  docName: {
    fontSize: 14.5,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  docDate: {
    fontSize: 11.5,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 1,
  },
  docHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  docContentBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  contentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  contentLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  revealBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  revealText: {
    fontSize: 11,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.terracotta,
  },
  contentText: {
    fontSize: 13,
    color: TRAVEL_THEME.colors.inkPrimary,
    lineHeight: 18,
  },
  contentMaskedText: {
    letterSpacing: 2,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(28, 25, 23, 0.45)",
  },
  modalSheet: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    ...TRAVEL_THEME.shadows.modal,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: TRAVEL_THEME.colors.borderSubtle,
    marginBottom: 10,
  },
  modalTitle: {
    fontFamily: "Georgia",
    fontSize: 18,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  fieldLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.inkMuted,
    marginBottom: 5,
  },
  kindScroll: {
    marginBottom: 12,
  },
  kindRow: {
    flexDirection: "row",
    gap: 7,
  },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  kindChipActive: {
    backgroundColor: TRAVEL_THEME.colors.terracottaLight,
    borderColor: "#F0D7D0",
  },
  kindChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  kindChipTextActive: {
    fontWeight: "700",
    color: TRAVEL_THEME.colors.terracottaDark,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  sensitiveToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sensitiveTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  sensitiveSubtitle: {
    fontSize: 11.5,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 1,
  },
});
