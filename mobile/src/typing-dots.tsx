import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { Skeleton } from "@/skeleton";
import { colors } from "@/theme";

function prefersReduceMotion() {
  if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(prefersReduceMotion);
  useEffect(() => {
    let alive = true;
    if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.matchMedia === "function") {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const apply = () => { if (alive) setReduce(media.matches); };
      apply();
      media.addEventListener?.("change", apply);
      return () => {
        alive = false;
        media.removeEventListener?.("change", apply);
      };
    }
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (alive) setReduce(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => { if (alive) setReduce(value); });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

export function TypingDots({ label }: { label?: string }) {
  const reduce = useReduceMotion();
  const progress = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  useEffect(() => {
    const native = Platform.OS !== "web";
    const loops = progress.map((value, index) => Animated.loop(Animated.sequence([
      Animated.delay(index * 160),
      Animated.timing(value, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      Animated.timing(value, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: native }),
      Animated.delay((2 - index) * 160),
    ])));
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [progress, reduce]);
  return (
    <View
      accessible={Boolean(label)}
      accessibilityRole={label ? "progressbar" : undefined}
      accessibilityLabel={label}
      style={styles.dots}
      {...(Platform.OS === "web" ? { dataSet: { motion: reduce ? "fade" : "bounce" } } : {})}
    >
      {progress.map((value, index) => {
        const motion = reduce
          ? { opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }
          : {
              opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
              transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
            };
        return <Animated.View key={index} style={[styles.dot, motion]} />;
      })}
    </View>
  );
}

export function TypingBubble({ label }: { label: string }) {
  return (
    <View style={styles.bubbleRow} accessibilityLiveRegion="polite">
      <View style={styles.bubble}>
        <TypingDots label={label} />
      </View>
    </View>
  );
}

export function TabLoading({ label = "Loading" }: { label?: string }) {
  const [showDots, setShowDots] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowDots(true), 300);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View style={styles.tab} accessibilityRole="progressbar" accessibilityLabel={label}>
      {showDots ? <TypingDots /> : <View style={styles.dotsSpacer} />}
      <Skeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 24, minWidth: 52 },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4, backgroundColor: colors.pine },
  bubbleRow: { alignItems: "flex-start", marginTop: 16, width: "100%" },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tab: { width: "100%", paddingTop: 8 },
  dotsSpacer: { height: 24 },
});
