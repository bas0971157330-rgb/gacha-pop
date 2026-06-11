export const SHIPPING_ADDRESS_STORAGE_KEY = "gacha_shipping_address";

export type ShippingAddress = {
  receiverName: string;
  phone: string;
  detail: string;
  houseNo: string;
  road: string;
  province: string;
  district: string;
  subdistrict: string;
  postalCode: string;
};

export type AddressSubdistrict = {
  subdistrict: string;
  postalCode: string;
};

export type AddressDistrict = {
  district: string;
  subdistricts: AddressSubdistrict[];
};

export type AddressOption = {
  province: string;
  districts: AddressDistrict[];
};

export const emptyShippingAddress: ShippingAddress = {
  receiverName: "",
  phone: "",
  detail: "",
  houseNo: "",
  road: "",
  province: "",
  district: "",
  subdistrict: "",
  postalCode: "",
};

export function isBangkokProvince(province: string) {
  const normalized = province.trim();
  return normalized === "กรุงเทพมหานคร" || normalized === "กรุงเทพฯ" || normalized.startsWith("กรุงเทพ");
}

export function getAddressAreaLabels(province: string) {
  const bangkok = isBangkokProvince(province);
  return {
    subdistrictLabel: bangkok ? "แขวง" : "ตำบล",
    districtLabel: bangkok ? "เขต" : "อำเภอ",
    subdistrictOptionLabel: bangkok ? "เลือกแขวง" : "เลือกตำบล",
    districtOptionLabel: bangkok ? "เลือกเขต" : "เลือกอำเภอ",
  };
}

const THAI_ADDRESS_OPTIONS_STORAGE_KEY = "gacha_thai_address_options_v1";
const THAI_ADDRESS_DATA_BASE_URL =
  "https://raw.githubusercontent.com/thailand-geography-data/thailand-geography-json/main/src";

type RemoteProvince = {
  provinceCode: number;
  provinceNameTh: string;
};

type RemoteDistrict = {
  provinceCode: number;
  districtCode: number;
  districtNameTh: string;
};

type RemoteSubdistrict = {
  districtCode: number;
  subdistrictNameTh: string;
  postalCode: number | string;
};

const detailedThaiAddressOptions: AddressOption[] = [
  {
    province: "กระบี่",
    districts: [
      {
        district: "คลองท่อม",
        subdistricts: [
          { subdistrict: "คลองท่อมเหนือ", postalCode: "81120" },
          { subdistrict: "คลองท่อมใต้", postalCode: "81120" },
          { subdistrict: "คลองพน", postalCode: "81170" },
          { subdistrict: "ทรายขาว", postalCode: "81170" },
          { subdistrict: "พรุดินนา", postalCode: "81120" },
          { subdistrict: "ห้วยน้ำขาว", postalCode: "81120" },
          { subdistrict: "เพหลา", postalCode: "81120" },
        ],
      },
      {
        district: "เมืองกระบี่",
        subdistricts: [
          { subdistrict: "กระบี่ใหญ่", postalCode: "81000" },
          { subdistrict: "กระบี่น้อย", postalCode: "81000" },
          { subdistrict: "ปากน้ำ", postalCode: "81000" },
          { subdistrict: "อ่าวนาง", postalCode: "81180" },
        ],
      },
      {
        district: "อ่าวลึก",
        subdistricts: [
          { subdistrict: "อ่าวลึกใต้", postalCode: "81110" },
          { subdistrict: "อ่าวลึกเหนือ", postalCode: "81110" },
          { subdistrict: "แหลมสัก", postalCode: "81110" },
        ],
      },
    ],
  },
  {
    province: "กรุงเทพมหานคร",
    districts: [
      {
        district: "คลองเตย",
        subdistricts: [
          { subdistrict: "คลองเตย", postalCode: "10110" },
          { subdistrict: "คลองตัน", postalCode: "10110" },
          { subdistrict: "พระโขนง", postalCode: "10110" },
        ],
      },
      {
        district: "บางรัก",
        subdistricts: [
          { subdistrict: "สีลม", postalCode: "10500" },
          { subdistrict: "สุริยวงศ์", postalCode: "10500" },
          { subdistrict: "บางรัก", postalCode: "10500" },
        ],
      },
    ],
  },
  {
    province: "เชียงใหม่",
    districts: [
      {
        district: "เมืองเชียงใหม่",
        subdistricts: [
          { subdistrict: "ศรีภูมิ", postalCode: "50200" },
          { subdistrict: "สุเทพ", postalCode: "50200" },
          { subdistrict: "ช้างเผือก", postalCode: "50300" },
        ],
      },
      {
        district: "หางดง",
        subdistricts: [
          { subdistrict: "หางดง", postalCode: "50230" },
          { subdistrict: "บ้านแหวน", postalCode: "50230" },
          { subdistrict: "สันผักหวาน", postalCode: "50230" },
        ],
      },
    ],
  },
];

const allThaiProvinceNames = [
  "กรุงเทพมหานคร",
  "กระบี่",
  "กาญจนบุรี",
  "กาฬสินธุ์",
  "กำแพงเพชร",
  "ขอนแก่น",
  "จันทบุรี",
  "ฉะเชิงเทรา",
  "ชลบุรี",
  "ชัยนาท",
  "ชัยภูมิ",
  "ชุมพร",
  "เชียงราย",
  "เชียงใหม่",
  "ตรัง",
  "ตราด",
  "ตาก",
  "นครนายก",
  "นครปฐม",
  "นครพนม",
  "นครราชสีมา",
  "นครศรีธรรมราช",
  "นครสวรรค์",
  "นนทบุรี",
  "นราธิวาส",
  "น่าน",
  "บึงกาฬ",
  "บุรีรัมย์",
  "ปทุมธานี",
  "ประจวบคีรีขันธ์",
  "ปราจีนบุรี",
  "ปัตตานี",
  "พระนครศรีอยุธยา",
  "พังงา",
  "พัทลุง",
  "พิจิตร",
  "พิษณุโลก",
  "เพชรบุรี",
  "เพชรบูรณ์",
  "แพร่",
  "พะเยา",
  "ภูเก็ต",
  "มหาสารคาม",
  "มุกดาหาร",
  "แม่ฮ่องสอน",
  "ยโสธร",
  "ยะลา",
  "ร้อยเอ็ด",
  "ระนอง",
  "ระยอง",
  "ราชบุรี",
  "ลพบุรี",
  "ลำปาง",
  "ลำพูน",
  "เลย",
  "ศรีสะเกษ",
  "สกลนคร",
  "สงขลา",
  "สตูล",
  "สมุทรปราการ",
  "สมุทรสงคราม",
  "สมุทรสาคร",
  "สระแก้ว",
  "สระบุรี",
  "สิงห์บุรี",
  "สุโขทัย",
  "สุพรรณบุรี",
  "สุราษฎร์ธานี",
  "สุรินทร์",
  "หนองคาย",
  "หนองบัวลำภู",
  "อ่างทอง",
  "อำนาจเจริญ",
  "อุดรธานี",
  "อุตรดิตถ์",
  "อุทัยธานี",
  "อุบลราชธานี",
];

const detailedProvinceNames = new Set(detailedThaiAddressOptions.map((item) => item.province));

export const thaiAddressOptions: AddressOption[] = [
  ...detailedThaiAddressOptions,
  ...allThaiProvinceNames
    .filter((province) => !detailedProvinceNames.has(province))
    .map((province) => ({ province, districts: [] })),
].sort((a, b) => a.province.localeCompare(b.province, "th"));

function sortAddressOptions(options: AddressOption[]) {
  return options
    .map((province) => ({
      ...province,
      districts: province.districts
        .map((district) => ({
          ...district,
          subdistricts: [...district.subdistricts].sort((a, b) => a.subdistrict.localeCompare(b.subdistrict, "th")),
        }))
        .sort((a, b) => a.district.localeCompare(b.district, "th")),
    }))
    .sort((a, b) => a.province.localeCompare(b.province, "th"));
}

function buildThaiAddressOptions(
  provinces: RemoteProvince[],
  districts: RemoteDistrict[],
  subdistricts: RemoteSubdistrict[],
) {
  const provinceMap = new Map<number, AddressOption>();
  const districtMap = new Map<number, AddressDistrict>();

  provinces.forEach((province) => {
    provinceMap.set(province.provinceCode, {
      province: province.provinceNameTh,
      districts: [],
    });
  });

  districts.forEach((district) => {
    const province = provinceMap.get(district.provinceCode);
    if (!province) return;

    const nextDistrict: AddressDistrict = {
      district: district.districtNameTh,
      subdistricts: [],
    };

    districtMap.set(district.districtCode, nextDistrict);
    province.districts.push(nextDistrict);
  });

  subdistricts.forEach((subdistrict) => {
    const district = districtMap.get(subdistrict.districtCode);
    if (!district) return;

    district.subdistricts.push({
      subdistrict: subdistrict.subdistrictNameTh,
      postalCode: String(subdistrict.postalCode),
    });
  });

  return sortAddressOptions([...provinceMap.values()]);
}

function readCachedAddressOptions() {
  if (!canUseStorage()) return null;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(THAI_ADDRESS_OPTIONS_STORAGE_KEY) ?? "null");
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as AddressOption[]) : null;
  } catch {
    return null;
  }
}

async function fetchAddressJson<T>(fileName: string) {
  const response = await fetch(`${THAI_ADDRESS_DATA_BASE_URL}/${fileName}`, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Cannot load ${fileName}`);
  }

  return (await response.json()) as T[];
}

export async function loadThaiAddressOptions() {
  const cachedOptions = readCachedAddressOptions();
  if (cachedOptions) return cachedOptions;

  try {
    const [provinces, districts, subdistricts] = await Promise.all([
      fetchAddressJson<RemoteProvince>("provinces.json"),
      fetchAddressJson<RemoteDistrict>("districts.json"),
      fetchAddressJson<RemoteSubdistrict>("subdistricts.json"),
    ]);
    const options = buildThaiAddressOptions(provinces, districts, subdistricts);

    if (canUseStorage()) {
      window.localStorage.setItem(THAI_ADDRESS_OPTIONS_STORAGE_KEY, JSON.stringify(options));
    }

    return options;
  } catch {
    return thaiAddressOptions;
  }
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getShippingAddressStorageKey(userId?: string | null) {
  return userId ? `${SHIPPING_ADDRESS_STORAGE_KEY}:${userId}` : SHIPPING_ADDRESS_STORAGE_KEY;
}

export function isShippingAddressComplete(address: ShippingAddress) {
  return Boolean(
    address.detail.trim() &&
      address.receiverName.trim() &&
      address.phone.trim() &&
      address.houseNo.trim() &&
      address.province.trim() &&
      address.district.trim() &&
      address.subdistrict.trim() &&
      address.postalCode.trim(),
  );
}

export function getShippingAddress(userId?: string | null) {
  if (!canUseStorage()) return emptyShippingAddress;

  try {
    const scopedKey = getShippingAddressStorageKey(userId);
    const scopedValue = window.localStorage.getItem(scopedKey);
    const legacyValue = userId ? window.localStorage.getItem(SHIPPING_ADDRESS_STORAGE_KEY) : null;
    const value = scopedValue ?? legacyValue ?? "{}";
    const address = { ...emptyShippingAddress, ...JSON.parse(value) };

    if (userId && !scopedValue && legacyValue && isShippingAddressComplete(address)) {
      window.localStorage.setItem(scopedKey, JSON.stringify(address));
    }

    return address;
  } catch {
    return emptyShippingAddress;
  }
}

export function saveShippingAddress(address: ShippingAddress, userId?: string | null) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(getShippingAddressStorageKey(userId), JSON.stringify(address));
  if (userId) {
    fetch("/api/shared-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shippingAddresses: { [userId]: address } }),
      keepalive: true,
    }).catch(() => undefined);
  }
}
