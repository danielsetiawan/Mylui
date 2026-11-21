import type React from 'react';
import {
  Tag, ShoppingBag, Utensils, Car, Plane, Home, Briefcase, Gamepad2, Heart, Music, BookOpen,
  Gift, Coffee, Dumbbell, ShoppingCart, Zap, CreditCard, PiggyBank, TrendingUp, Bus, Bike,
  Globe, Baby, Dog, Smartphone, Monitor, Shirt, Scissors, Star, ArrowUpRight, ArrowDownRight,
  ArrowRightLeft, Wallet, Cookie, IceCream2, Pizza, Sandwich, Soup, MapPin, Map as MapIcon, Compass,
  Mountain, Truck, Fuel, Wrench, Banknote, ShoppingBasket, Package, Trees, Umbrella, Flame, Tent,
  Repeat, Coins, Receipt, Landmark,
} from 'lucide-react';

/**
 * Category icon NAME (stored in transaction_categories.icon) → lucide component.
 * The names are a contract with the database and the mobile app's getCategoryIcon;
 * the list of names a user can pick is AVAILABLE_ICONS in master-data/CategoriesPage.tsx.
 * Used by the Dashboard, Activity list and Planning.
 */
export const ICON_MAP: Record<string, React.ElementType> = {
  Tag, ShoppingBag, Utensils, Car, Plane, Home, Briefcase, Gamepad2, Heart, Music, BookOpen,
  Gift, Coffee, Dumbbell, ShoppingCart, Zap, CreditCard, PiggyBank, TrendingUp, Bus, Bike,
  Globe, Baby, Dog, Smartphone, Monitor, Shirt, Scissors, Star, ArrowUpRight, ArrowDownRight,
  ArrowRightLeft, Wallet, Cookie, IceCream2, Pizza, Sandwich, Soup, MapPin, Compass,
  Mountain, Truck, Fuel, Wrench, Banknote, ShoppingBasket, Package, Trees, Umbrella, Flame, Tent,
  Map: MapIcon, Repeat, Coins, Receipt, Landmark,
};

/** Unknown or empty names fall back to the Tag icon */
export function getCategoryIcon(iconName?: string | null): React.ElementType {
  if (iconName && ICON_MAP[iconName]) return ICON_MAP[iconName];
  return Tag;
}
