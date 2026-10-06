import { memo, useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CATEGORIES, CategoryId, Drink, getIngredient, selectedIds } from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { DURATION, timing } from '../motion';
import { colors, fonts } from '../theme';
import { IngredientIcon } from './art/IngredientIcon';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The ingredient pictured on each tab. */
const TAB_ICON: Record<CategoryId, string> = {
  toppings: 'pearls',
  sweetness: '50',
  ice: 'regular',
  tea: 'black',
  milk: 'whole',
  foam: 'cheese',
};

const TAB_GAP = 4;

interface IngredientPanelProps {
  config: DayConfig;
  cup: Drink;
  activeCategory: CategoryId;
  onSelectCategory: (category: CategoryId) => void;
  onPick: (category: CategoryId, optionId: string) => void;
}

export const IngredientPanel = memo(function IngredientPanel({
  config,
  cup,
  activeCategory,
  onSelectCategory,
  onPick,
}: IngredientPanelProps) {
  const chosen = selectedIds(cup, activeCategory);
  const [tabsWidth, setTabsWidth] = useState(0);
  const tabCount = config.categories.length;
  const tabWidth = tabsWidth > 0 ? (tabsWidth - TAB_GAP * (tabCount - 1)) / tabCount : 0;
  const activeIndex = config.categories.indexOf(activeCategory);

  const indicator = useSharedValue(activeIndex);
  useEffect(() => {
    indicator.value = withTiming(activeIndex, timing(DURATION.base));
  }, [activeIndex, indicator]);
  const indicatorStyle = useAnimatedStyle(() => ({
    width: tabWidth,
    transform: [{ translateX: indicator.value * (tabWidth + TAB_GAP) }],
  }));

  return (
    <View style={styles.panel}>
      <View style={styles.tabs} onLayout={(event: LayoutChangeEvent) => setTabsWidth(event.nativeEvent.layout.width)}>
        {tabWidth > 0 && <Animated.View style={[styles.indicator, indicatorStyle]} />}
        {config.categories.map((category) => {
          const active = category === activeCategory;
          const filled = selectedIds(cup, category).length > 0;
          return (
            <Pressable
              key={category}
              onPress={() => onSelectCategory(category)}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityLabel={CATEGORIES[category].label}
              accessibilityState={{ selected: active }}
            >
              <IngredientIcon category={category} id={TAB_ICON[category]} size={20} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{CATEGORIES[category].label}</Text>
              {filled && <View style={styles.tabDot} />}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.grid}>
        {config.options[activeCategory].map((id) => {
          const option = getIngredient(activeCategory, id);
          if (!option) return null;
          return (
            <OptionButton
              key={`${activeCategory}-${id}`}
              label={option.name}
              selected={chosen.includes(id)}
              onPress={() => onPick(activeCategory, id)}
            >
              <IngredientIcon category={activeCategory} id={id} size={30} />
            </OptionButton>
          );
        })}
      </View>
    </View>
  );
});

interface OptionButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  children: React.ReactNode;
}

function OptionButton({ label, selected, onPress, children }: OptionButtonProps) {
  const press = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return (
    <AnimatedPressable
      onPressIn={() => press.set(withTiming(0.96, { duration: 80 }))}
      onPressOut={() => press.set(withTiming(1, timing(DURATION.fast)))}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>{children}</View>
      <Text style={styles.optionLabel} numberOfLines={2}>
        {label}
      </Text>
      {selected && (
        <View style={styles.optionCheck}>
          <Text style={styles.optionCheckText}>✓</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 6,
  },
  tabs: {
    flexDirection: 'row',
    gap: TAB_GAP,
    marginBottom: 8,
    backgroundColor: colors.floor,
    borderRadius: 14,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  tabDot: {
    position: 'absolute',
    top: 3,
    right: 5,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.good,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  option: {
    width: '31.8%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 5,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 2,
    borderBottomWidth: 3.5,
    borderColor: colors.line,
    backgroundColor: '#FFFFFF',
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.floor,
  },
  optionIconSelected: {
    backgroundColor: '#FFFFFF',
  },
  optionLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: fonts.semi,
    color: colors.ink,
  },
  optionCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  optionCheckText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 13,
    fontFamily: fonts.display,
  },
});
