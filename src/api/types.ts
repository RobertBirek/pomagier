export interface ProductRow {
  id: number;
  symbol: string;
  name: string;
  barcode: string;
  unit: string;
  description: string;
  stock: number;
  reserved: number;
}

export interface ProductDetailRow {
  tw_Id: number;
  tw_Symbol: string;
  tw_Nazwa: string;
  tw_Opis: string;
  tw_PodstKodKresk: string;
  tw_JednMiary: string;
  tw_PKWiU: string;
  tw_KodTowaru: string;
  tw_StanMin: number;
  tw_JednStanMin: string;
  tw_StanMaks: number;
  tw_DniWaznosc: number;
  tw_Masa: number;
  tw_MasaNetto: number;
  tw_CenaOtwarta: number;
  tw_ObjetySysKaucyjnym: boolean;
  tw_Zablokowany: boolean;
  tw_Pole1: string;
  tw_Pole2: string;
  tw_Pole3: string;
  tw_IdGrupa: number;
  tw_IdVatSp: number;
  tw_UrzNazwa: string;
}

export interface UserRow {
  id: number;
  firstName: string;
  lastName: string;
  active: number | boolean;
}

export interface WarehouseRow {
  id: number;
  symbol: string;
  name: string;
  isMain: boolean;
}

export interface CompanyRow {
  name: string;
  shortName: string;
  nip: string;
  regon: string;
  street: string;
  houseNo: string;
  aptNo: string;
  postalCode: string;
  city: string;
  phone: string;
  www: string;
  email: string;
  bankName: string;
  bankAccount: string;
}

export interface StockRow {
  warehouseId: number;
  warehouseSymbol: string;
  warehouseName: string;
  quantity: number;
  reserved: number;
  minQuantity: number;
  maxQuantity: number;
}

export interface ScanResultRow {
  productId: number;
  symbol: string;
  name: string;
  description: string;
  barcode: string;
  unit: string;
  warehouseId: number | null;
  warehouseSymbol: string | null;
  warehouseName: string | null;
  quantity: number;
  reserved: number;
  minQuantity: number;
  maxQuantity: number;
}

export interface StatRow {
  cnt: number;
}

export interface VatRow {
  vat_Nazwa: string;
}

export interface GroupRow {
  grt_Nazwa: string;
}

export interface SessionRow {
  id: string;
  userId: string;
  loginTime: string;
  expiresAt: string;
}
