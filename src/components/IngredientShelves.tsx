import { memo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CategoryId, Drink, getIngredient, selectedIds } from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { DURATION, timing } from '../motion';
import { colors, fonts } from '../theme';
import { IngredientIcon } from './art/IngredientIcon';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface IngredientShelvesProps {
  config: DayConfig;
  cup: Drink;
  onPick: (category: CategoryId, optionId: string) => void;
}

/**
 * The kitchen wall of supplies, and the whole ingredient selector in one: a stack of wooden shelves,
 * one per unlocked category, each holding that category's ingredients as real, tappable objects
 * (tins of tea, jars of toppings, cartons of milk…). Tapping an object adds it to the cup — there is
 * no separate card panel. Shelves share the available height evenly, so early days show big objects
 * and later days pack more shelves in without scrolling.
 */
export const IngredientShelves = memo(function IngredientShelves({ config, cup, onPick }: IngredientShelvesProps) {
  const [height, setHeight] = useState(0);
  const n = config.categories.length;
  const rowHeight = n > 0 ? height / n : 0;
  // Cap the row the icon sizes against, so a day with few shelves gets big-but-not-huge objects.
  const iconSize = Math.max(20, Math.min(46, Math.round(Math.min(rowHeight, 118) * 0.46)));
  // On very short shelves (lots of categories on a small screen), drop the captions so they can't
  // bleed into the shelf below; the icons plus the recipe still say what each object is.
  const showLabel = rowHeight >= 52;

  return (
    <View style={styles.wall} onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 &&
        config.categories.map((category) => (
          <Shelf
            key={category}
            category={category}
            options={config.options[category]}
            cup={cup}
            iconSize={iconSize}
            showLabel={showLabel}
            onPick={onPick}
          />
        ))}
    </View>
  );
});

interface ShelfProps {
  category: CategoryId;
  options: string[];
  cup: Drink;
  iconSize: number;
  showLabel: boolean;
  onPick: (category: CategoryId, optionId: string) => void;
}

function Shelf({ category, options, cup, iconSize, showLabel, onPick }: ShelfProps) {
  const chosen = selectedIds(cup, category);
  return (
    <View style={styles.shelf}>
      <View style={styles.objects}>
        {options.map((id) => (
          <IngredientObject
            key={id}
            category={category}
            id={id}
            iconSize={iconSize}
            showLabel={showLabel}
            selected={chosen.includes(id)}
            onPress={() => onPick(category, id)}
          />
        ))}
      </View>
      {/* the wooden plank the objects stand on */}
      <View style={styles.plank}>
        <View style={styles.plankLip} />
      </View>
    </View>
  );
}

interface IngredientObjectProps {
  category: CategoryId;
  id: string;
  iconSize: number;
  showLabel: boolean;
  selected: boolean;
  onPress: () => void;
}

function IngredientObject({ category, id, iconSize, showLabel, selected, onPress }: IngredientObjectProps) {
  const option = getIngredient(category, id);
  const press = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  if (!option) return null;

  return (
    <AnimatedPressable
      onPressIn={() => press.set(withTiming(0.9, { duration: 80 }))}
      onPressOut={() => press.set(withTiming(1, timing(DURATION.fast)))}
      onPress={onPress}
      style={[styles.object, style]}
      accessibilityRole="button"
      accessibilityLabel={option.name}
      accessibilityState={{ selected }}
    >
      <View style={[styles.pedestal, selected && styles.pedestalSelected]}>
        <IngredientIcon category={category} id={id} size={iconSize} />
        {selected && (
          <View style={styles.check}>
            <Text style={styles.checkText}>✓</Text>
          </View>
        )}
      </View>
      {showLabel && (
        <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
          {option.name}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const WOOD = colors.counter;
const WOOD_DARK = '#9A6A3C';

const styles = StyleSheet.create({
  wall: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 6,
    justifyContent: 'space-around',
  },
  shelf: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    maxHeight: 118,
    justifyContent: 'flex-end',
  },
  objects: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  object: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
    gap: 1,
  },
  pedestal: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pedestalSelected: {
    backgroundColor: colors.primaryTint,
    borderColor: colors.primary,
  },
  check: {
    position: 'absolute',
    top: -7,
    right: -5,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 12,
    fontFamily: fonts.display,
  },
  label: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: fonts.semi,
    color: colors.ink,
    maxWidth: '100%',
  },
  labelSelected: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
  },
  plank: {
    height: 9,
    borderRadius: 3,
    backgroundColor: WOOD,
    borderBottomWidth: 3,
    borderBottomColor: WOOD_DARK,
    justifyContent: 'center',
  },
  plankLip: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: '#F0CDA0',
    opacity: 0.7,
  },
});
