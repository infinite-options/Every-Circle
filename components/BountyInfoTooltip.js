import React, { useState, useRef, useLayoutEffect } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/** Copy shown next to bounty fields / metrics, by audience. */
export const BOUNTY_INFO_COPY = {
  seller:
    "Offer a bounty to reward people in your network who refer buyers. You pay it—not the buyer—so referrals can grow your sales without raising the price. Per item pays on each unit sold; single bounty is one payment for the sale.",
  referrer:
    "Earn part of this bounty when someone you referred buys. Bounty is pending until the buyer confirms receipt (and through any return window for returnable items). Look for the 💰 and recommend offerings with bounties to your network—you get rewarded when they purchase.",
};

const TOOLTIP_WIDTH = 260;
const TOOLTIP_Z = 100000;

let createPortal = null;
if (Platform.OS === "web" && typeof document !== "undefined") {
  try {
    createPortal = require("react-dom").createPortal;
  } catch (_) {
    createPortal = null;
  }
}

function resolveDomNode(ref) {
  if (!ref) return null;
  if (typeof ref.getBoundingClientRect === "function") return ref;
  if (ref._nativeNode && typeof ref._nativeNode.getBoundingClientRect === "function") return ref._nativeNode;
  return null;
}

/**
 * Hover info icon for bounty. Web: tooltip on hover (ported to document.body so it isn't clipped).
 *
 * @param {"seller"|"referrer"} [perspective="seller"]
 * @param {boolean} [darkMode]
 * @param {"right"|"left"} [placement="right"] which side the tooltip opens toward
 * @param {string} [message] optional override; defaults to BOUNTY_INFO_COPY[perspective]
 * @param {string} [accessibilityLabel] optional a11y label when using custom message
 */
export default function BountyInfoTooltip({ perspective = "seller", darkMode = false, placement = "right", message, accessibilityLabel }) {
  const [visible, setVisible] = useState(false);
  const [fixedPos, setFixedPos] = useState(null);
  const anchorRef = useRef(null);
  const body = message || BOUNTY_INFO_COPY[perspective] || BOUNTY_INFO_COPY.seller;
  const isWeb = Platform.OS === "web";

  useLayoutEffect(() => {
    if (!visible || !isWeb) {
      setFixedPos(null);
      return;
    }
    const measure = () => {
      const el = resolveDomNode(anchorRef.current);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const top = Math.max(8, rect.top - 4);
      const viewportW = typeof window !== "undefined" ? window.innerWidth : 400;
      let left;
      if (placement === "left") {
        left = Math.max(8, rect.left - TOOLTIP_WIDTH - 8);
      } else {
        left = Math.min(rect.right + 8, viewportW - TOOLTIP_WIDTH - 8);
        left = Math.max(8, left);
      }
      setFixedPos({ top, left });
    };
    measure();
    if (typeof window === "undefined") return undefined;
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [visible, isWeb, placement]);

  const tooltipNode = visible ? (
    <View
      style={[
        styles.tooltip,
        darkMode && styles.tooltipDark,
        isWeb && fixedPos
          ? {
              position: "fixed",
              top: fixedPos.top,
              left: fixedPos.left,
              right: "auto",
            }
          : placement === "left"
            ? styles.tooltipLeft
            : styles.tooltipRight,
      ]}
      pointerEvents='none'
    >
      <Text style={[styles.tooltipText, darkMode && styles.tooltipTextDark]}>{body}</Text>
    </View>
  ) : null;

  const webPortalTooltip = isWeb && visible && fixedPos && createPortal && typeof document !== "undefined" ? createPortal(tooltipNode, document.body) : null;

  return (
    <View
      ref={anchorRef}
      style={styles.anchor}
      onMouseEnter={isWeb ? () => setVisible(true) : undefined}
      onMouseLeave={isWeb ? () => setVisible(false) : undefined}
      accessibilityRole='image'
      accessibilityLabel={accessibilityLabel || (perspective === "referrer" ? "About earning bounty" : "About setting a bounty")}
    >
      <Ionicons name='information-circle-outline' size={16} color={visible ? (darkMode ? "#c4b5fd" : "#4B2E83") : darkMode ? "#999" : "#666"} />
      {/* Native / no-portal fallback stays in-tree; web uses portal above. */}
      {!webPortalTooltip ? tooltipNode : null}
      {webPortalTooltip}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    zIndex: TOOLTIP_Z,
    elevation: TOOLTIP_Z,
    ...(Platform.OS === "web" ? { cursor: "help" } : null),
  },
  tooltip: {
    position: "absolute",
    top: -6,
    width: TOOLTIP_WIDTH,
    zIndex: TOOLTIP_Z,
    elevation: TOOLTIP_Z,
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(75,46,131,0.25)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  tooltipRight: {
    left: 22,
  },
  tooltipLeft: {
    right: 22,
  },
  tooltipDark: {
    backgroundColor: "#2a2a2a",
    borderColor: "rgba(196,181,253,0.35)",
  },
  tooltipText: {
    fontSize: 12,
    lineHeight: 17,
    color: "#555",
  },
  tooltipTextDark: {
    color: "#ccc",
  },
});
