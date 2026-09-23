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
import {
  addFlight,
  addHotel,
  addReservation,
  deleteFlight,
  deleteHotel,
  deleteReservation,
  fetchTripBundle,
} from "@/shared/api";
import { fmtDate, fmtMoney, TABULAR_NUMS, TRAVEL_THEME } from "@/shared/theme";
import type { Flight, Hotel, Reservation, TripBundle } from "@/shared/types";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { SheetHandle } from "@/components/GlassView";

export default function ReservationsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<TripBundle | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | "HOTELS" | "FLIGHTS" | "BOOKINGS">("ALL");
  const [refreshing, setRefreshing] = useState(false);

  // Add Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<"HOTEL" | "FLIGHT" | "BOOKING">("HOTEL");
  const [title, setTitle] = useState("");
  const [dateA, setDateA] = useState("");
  const [dateB, setDateB] = useState("");
  const [locationName, setLocationName] = useState("");
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchTripBundle(tripId);
      setBundle(data);
    } catch {}
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!bundle) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator color={TRAVEL_THEME.colors.terracotta} size="large" />
      </View>
    );
  }

  const { hotels, flights, reservations, trip } = bundle;
  const totalCount = hotels.length + flights.length + reservations.length;

  async function handleAdd() {
    if (!title.trim()) {
      Alert.alert("Required", "Please enter a title / name.");
      return;
    }
    setSaving(true);
    try {
      if (modalType === "HOTEL") {
        await addHotel(tripId, {
          name: title.trim(),
          checkIn: dateA.trim() || trip.startDate,
          checkOut: dateB.trim() || trip.endDate,
          address: locationName.trim() || undefined,
          confirmationNumber: confirmationNumber.trim() || undefined,
          costPerNight: Number(cost) || 0,
        });
      } else if (modalType === "FLIGHT") {
        const parts = locationName.split("->").map((p) => p.trim());
        await addFlight(tripId, {
          airline: title.trim(),
          flightNumber: confirmationNumber.trim() || "FL-101",
          originCode: parts[0] || "MNL",
          originCity: parts[0] || "Origin",
          destCode: parts[1] || "NRT",
          destCity: parts[1] || "Destination",
          departAt: dateA.trim() || trip.startDate,
          arriveAt: dateB.trim() || trip.startDate,
          price: Number(cost) || 0,
        });
      } else {
        await addReservation(tripId, {
          title: title.trim(),
          type: "ACTIVITY",
          dateTime: dateA.trim() || trip.startDate,
          locationName: locationName.trim() || undefined,
          confirmationNumber: confirmationNumber.trim() || undefined,
          cost: Number(cost) || undefined,
          notes: notes.trim() || undefined,
        });
      }
      setModalVisible(false);
      setTitle("");
      setLocationName("");
      setConfirmationNumber("");
      setCost("");
      setNotes("");
      await load();
    } catch {
      Alert.alert("Error", "Could not save booking.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(type: "HOTEL" | "FLIGHT" | "BOOKING", id: string, name: string) {
    Alert.alert("Remove Booking", `Remove "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            if (type === "HOTEL") await deleteHotel(tripId, id);
            else if (type === "FLIGHT") await deleteFlight(tripId, id);
            else await deleteReservation(tripId, id);
            await load();
          } catch {
            Alert.alert("Error", "Could not delete booking.");
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Editorial Header */}
      <Header
        eyebrow="STAYS & BOOKINGS"
        title="Reservations"
        rightAction={
          <Button
            label="Add"
            iconLeft={<Ionicons name="add" size={16} color="#FFFFFF" />}
            variant="primary"
            size="sm"
            onPress={() => setModalVisible(true)}
          />
        }
      />

      {/* Segmented Filter Control */}
      <View style={styles.filterBar}>
        <SegmentedControl
          options={[
            { key: "ALL", label: `All (${totalCount})` },
            { key: "HOTELS", label: `Stays (${hotels.length})` },
            { key: "FLIGHTS", label: `Flights (${flights.length})` },
            { key: "BOOKINGS", label: `Activities (${reservations.length})` },
          ]}
          value={activeTab}
          onChange={setActiveTab}
          accentColor={TRAVEL_THEME.colors.terracotta}
        />
      </View>

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
        {totalCount === 0 ? (
          <EmptyState
            icon={<Ionicons name="bed-outline" size={44} color={TRAVEL_THEME.colors.terracotta} />}
            title="No bookings or stays yet"
            description="Add your confirmed flights, hotel stays, train tickets, and dinner reservations to keep all confirmation codes in one place."
            actionLabel="+ Add Booking"
            onAction={() => setModalVisible(true)}
          />
        ) : (
          <View style={styles.bookingList}>
            {/* Flights */}
            {(activeTab === "ALL" || activeTab === "FLIGHTS") &&
              flights.map((f) => (
                <Card key={f.id} padding={16} style={styles.flightCard}>
                  {/* Boarding Pass Header */}
                  <View style={styles.passHeader}>
                    <View style={styles.airlineRow}>
                      <Ionicons name="airplane" size={15} color={TRAVEL_THEME.colors.ocean} />
                      <Text style={styles.airlineName}>{f.airline}</Text>
                      <Text style={styles.flightNum}>{f.flightNumber}</Text>
                    </View>
                    <View style={styles.passHeaderRight}>
                      <Badge label={f.status || "CONFIRMED"} variant="ocean" size="sm" />
                      <TouchableOpacity
                        onPress={() => handleDelete("FLIGHT", f.id, `${f.airline} ${f.flightNumber}`)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={15} color={TRAVEL_THEME.colors.inkDim} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Route Indicator */}
                  <View style={styles.routeRow}>
                    <View>
                      <Text style={[styles.airportCode, TABULAR_NUMS]}>{f.originCode}</Text>
                      <Text style={styles.cityName}>{f.originCity}</Text>
                    </View>
                    <View style={styles.flightTrack}>
                      <View style={styles.flightTrackLine} />
                      <Ionicons name="airplane-sharp" size={14} color={TRAVEL_THEME.colors.ocean} />
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.airportCode, TABULAR_NUMS]}>{f.destCode}</Text>
                      <Text style={styles.cityName}>{f.destCity}</Text>
                    </View>
                  </View>

                  {/* Flight Footnote */}
                  <View style={styles.flightFootnote}>
                    <Text style={[styles.footDate, TABULAR_NUMS]}>
                      Depart: {fmtDate(f.departAt)}
                    </Text>
                    {f.confirmation && (
                      <Text style={[styles.footCode, TABULAR_NUMS]}>
                        Conf: #{f.confirmation}
                      </Text>
                    )}
                  </View>
                </Card>
              ))}

            {/* Hotels */}
            {(activeTab === "ALL" || activeTab === "HOTELS") &&
              hotels.map((h) => (
                <Card key={h.id} padding={16} style={styles.hotelCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardIconTitle}>
                      <View style={[styles.hotelIconBubble, { backgroundColor: TRAVEL_THEME.colors.oceanLight }]}>
                        <Ionicons name="bed" size={15} color={TRAVEL_THEME.colors.oceanDark} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.hotelTitle} numberOfLines={1}>
                          {h.name}
                        </Text>
                        <Text style={styles.hotelAddress} numberOfLines={1}>
                          {h.address || "Address confirmed"}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDelete("HOTEL", h.id, h.name)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={15} color={TRAVEL_THEME.colors.inkDim} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.hotelDatesRow}>
                    <View style={styles.dateBlock}>
                      <Text style={styles.dateBlockLabel}>CHECK-IN</Text>
                      <Text style={[styles.dateBlockValue, TABULAR_NUMS]}>{fmtDate(h.checkIn)}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={14} color={TRAVEL_THEME.colors.inkDim} />
                    <View style={styles.dateBlock}>
                      <Text style={styles.dateBlockLabel}>CHECK-OUT</Text>
                      <Text style={[styles.dateBlockValue, TABULAR_NUMS]}>{fmtDate(h.checkOut)}</Text>
                    </View>
                    <View style={[styles.dateBlock, { alignItems: "flex-end", flex: 1 }]}>
                      <Text style={styles.dateBlockLabel}>STAY</Text>
                      <Text style={styles.dateBlockValue}>{h.nights || 1} nights</Text>
                    </View>
                  </View>

                  {h.confirmationNumber && (
                    <View style={styles.confirmationRow}>
                      <Text style={styles.confLabel}>BOOKING CONFIRMATION</Text>
                      <Text style={[styles.confCode, TABULAR_NUMS]}>#{h.confirmationNumber}</Text>
                    </View>
                  )}
                </Card>
              ))}

            {/* Activities & Reservations */}
            {(activeTab === "ALL" || activeTab === "BOOKINGS") &&
              reservations.map((r) => (
                <Card key={r.id} padding={14} style={styles.resCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardIconTitle}>
                      <View style={[styles.hotelIconBubble, { backgroundColor: TRAVEL_THEME.colors.amberLight }]}>
                        <Ionicons name="bookmark" size={14} color={TRAVEL_THEME.colors.amberDark} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.hotelTitle} numberOfLines={1}>
                          {r.title}
                        </Text>
                        <Text style={styles.hotelAddress} numberOfLines={1}>
                          {r.locationName || fmtDate(r.dateTime)}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDelete("BOOKING", r.id, r.title)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={15} color={TRAVEL_THEME.colors.inkDim} />
                    </TouchableOpacity>
                  </View>

                  {r.confirmationNumber && (
                    <View style={[styles.confirmationRow, { marginTop: 8 }]}>
                      <Text style={styles.confLabel}>REFERENCE</Text>
                      <Text style={[styles.confCode, TABULAR_NUMS]}>#{r.confirmationNumber}</Text>
                    </View>
                  )}
                </Card>
              ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Bottom Nav */}
      <BottomNav tripId={tripId} activeTab="wallet" accentColor={TRAVEL_THEME.colors.terracotta} />

      {/* Add Booking Modal Bottom Sheet */}
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
              <Text style={styles.modalTitle}>Add Booking / Stay</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={TRAVEL_THEME.colors.inkMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Type Switcher */}
              <Text style={styles.fieldLabel}>BOOKING CATEGORY</Text>
              <SegmentedControl
                options={[
                  { key: "HOTEL", label: "Hotel Stay" },
                  { key: "FLIGHT", label: "Flight" },
                  { key: "BOOKING", label: "Activity" },
                ]}
                value={modalType}
                onChange={setModalType}
                accentColor={TRAVEL_THEME.colors.terracotta}
              />

              {/* Title / Name */}
              <View style={[styles.fieldGroup, { marginTop: 12 }]}>
                <Text style={styles.fieldLabel}>
                  {modalType === "HOTEL" ? "HOTEL NAME" : modalType === "FLIGHT" ? "AIRLINE NAME" : "ACTIVITY TITLE"}
                </Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={
                    modalType === "HOTEL"
                      ? "e.g. Park Hyatt Tokyo"
                      : modalType === "FLIGHT"
                        ? "e.g. All Nippon Airways (ANA)"
                        : "e.g. TeamLab Planets, Omakase Sushi"
                  }
                  placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                  style={styles.input}
                />
              </View>

              {/* Location or Route */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {modalType === "FLIGHT" ? "ROUTE (ORIGIN -> DEST)" : "LOCATION / ADDRESS"}
                </Text>
                <TextInput
                  value={locationName}
                  onChangeText={setLocationName}
                  placeholder={
                    modalType === "FLIGHT"
                      ? "e.g. MNL -> NRT"
                      : "e.g. Shinjuku, Tokyo"
                  }
                  placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                  style={styles.input}
                />
              </View>

              {/* Dates */}
              <View style={styles.fieldGroup}>
                <View style={styles.rowTwoCols}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>START / DEPART DATE</Text>
                    <TextInput
                      value={dateA}
                      onChangeText={setDateA}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                      style={[styles.input, TABULAR_NUMS]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>END / ARRIVE DATE</Text>
                    <TextInput
                      value={dateB}
                      onChangeText={setDateB}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                      style={[styles.input, TABULAR_NUMS]}
                    />
                  </View>
                </View>
              </View>

              {/* Confirmation Code & Cost */}
              <View style={styles.fieldGroup}>
                <View style={styles.rowTwoCols}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={styles.fieldLabel}>CONFIRMATION #</Text>
                    <TextInput
                      value={confirmationNumber}
                      onChangeText={setConfirmationNumber}
                      placeholder="e.g. #H-98214"
                      placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                      style={[styles.input, TABULAR_NUMS]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>COST ({trip.homeCurrency})</Text>
                    <TextInput
                      value={cost}
                      onChangeText={setCost}
                      placeholder="0"
                      keyboardType="numeric"
                      placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                      style={[styles.input, TABULAR_NUMS]}
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <Button
              label="Save Booking"
              variant="primary"
              size="lg"
              loading={saving}
              onPress={handleAdd}
              style={{ marginTop: 14 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
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
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: TRAVEL_THEME.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: TRAVEL_THEME.colors.border,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
  },
  bookingList: {
    gap: 12,
  },
  flightCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
    ...TRAVEL_THEME.shadows.card,
  },
  passHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: TRAVEL_THEME.colors.borderSubtle,
    paddingBottom: 10,
  },
  airlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  airlineName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  flightNum: {
    fontSize: 12,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  passHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  airportCode: {
    fontSize: 24,
    fontWeight: "800",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  cityName: {
    fontSize: 11.5,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 1,
  },
  flightTrack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    paddingHorizontal: 16,
  },
  flightTrackLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: TRAVEL_THEME.colors.borderStrong,
  },
  flightFootnote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: TRAVEL_THEME.colors.borderSubtle,
  },
  footDate: {
    fontSize: 12,
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  footCode: {
    fontSize: 12,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.oceanDark,
  },
  hotelCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
    ...TRAVEL_THEME.shadows.card,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardIconTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  hotelIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  hotelTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  hotelAddress: {
    fontSize: 12,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 1,
  },
  hotelDatesRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: TRAVEL_THEME.colors.borderSubtle,
    gap: 12,
  },
  dateBlock: {
    gap: 2,
  },
  dateBlockLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  dateBlockValue: {
    fontSize: 13,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  confirmationRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: TRAVEL_THEME.colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  confLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  confCode: {
    fontSize: 12,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.terracotta,
  },
  resCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
    ...TRAVEL_THEME.shadows.card,
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
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.inkMuted,
    marginBottom: 5,
  },
  rowTwoCols: {
    flexDirection: "row",
    gap: 10,
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
});
