import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeCartItemFulfillment } from "./cartFulfillmentMethod";

/** Load all cart line items and total count from AsyncStorage (business + expertise carts). */
export async function loadAllCartItems() {
  const keys = await AsyncStorage.getAllKeys();
  const cartKeys = keys.filter((key) => key.startsWith("cart_"));

  let cartCount = 0;
  let cartItems = [];

  for (const key of cartKeys) {
    const cartData = await AsyncStorage.getItem(key);
    if (!cartData) continue;

    const parsed = JSON.parse(cartData);

    if (key.startsWith("cart_expertise_")) {
      cartCount += 1;
      cartItems.push(normalizeCartItemFulfillment({ ...parsed, cart_key: key }));
    } else {
      const items = parsed.items || [];
      cartCount += items.length;
      const businessUid = key.replace("cart_", "");
      cartItems = [
        ...cartItems,
        ...items.map((item) =>
          normalizeCartItemFulfillment({
            ...item,
            business_uid: businessUid,
          }),
        ),
      ];
    }
  }

  return { cartCount, cartItems };
}
