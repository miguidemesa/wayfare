import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { Card } from "./Surface";
import { TRAVEL_THEME } from "@/shared/theme";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  return (
    <Card padding={28} style={styles.container}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}

      {(actionLabel || secondaryLabel) && (
        <View style={styles.actionRow}>
          {actionLabel && onAction && (
            <Button
              label={actionLabel}
              onPress={onAction}
              variant="primary"
              size="md"
            />
          )}
          {secondaryLabel && onSecondaryAction && (
            <Button
              label={secondaryLabel}
              onPress={onSecondaryAction}
              variant="secondary"
              size="md"
            />
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    marginVertical: 16,
    backgroundColor: TRAVEL_THEME.colors.surface,
  },
  iconContainer: {
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 20,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
    textAlign: "center",
  },
  description: {
    marginTop: 6,
    fontSize: 13.5,
    lineHeight: 20,
    color: TRAVEL_THEME.colors.inkMuted,
    textAlign: "center",
    maxWidth: 320,
  },
  actionRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
});
