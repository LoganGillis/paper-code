import type { Page } from './api'

export const GUIDE_PAGE_ID = 'paper:guide'
export const GUIDE_ORDERS_ID = 'paper:guide:orders'
export const GUIDE_PRODUCTS_ID = 'paper:guide:products'

export function isGuidePageId(id: string): boolean {
  return id === GUIDE_PAGE_ID
}

export const GUIDE_ORDERS_CSV = `order_id,date,customer,region,sku,qty,status
1001,2026-03-02,Northwind,East,SKU-TEA,3,paid
1002,2026-03-02,Contoso,West,SKU-MUG,2,paid
1003,2026-03-03,Adventure,East,SKU-TEA,1,pending
1004,2026-03-04,Fabrikam,South,SKU-BAG,1,paid
1005,2026-03-04,Northwind,East,SKU-MUG,4,paid
1006,2026-03-05,Contoso,West,SKU-LMP,1,refunded
1007,2026-03-06,Adventure,East,SKU-BAG,2,paid
1008,2026-03-07,Wide World,North,SKU-TEA,6,paid
1009,2026-03-08,Fabrikam,South,SKU-NTB,1,pending
1010,2026-03-08,Northwind,East,SKU-TEA,2,paid
1011,2026-03-09,Contoso,West,SKU-MUG,1,paid
1012,2026-03-10,Wide World,North,SKU-BAG,3,paid
`

export const GUIDE_PRODUCTS_CSV = `sku,product,category,unit_price,in_stock
SKU-TEA,Cedar tea,Grocery,8.5,true
SKU-MUG,Stoneware mug,Home,14,true
SKU-BAG,Canvas tote,Apparel,22,true
SKU-LMP,Desk lamp,Home,48,false
SKU-NTB,Lined notebook,Stationery,6.25,true
SKU-PEN,Fountain pen,Stationery,18,true
`

export function isGuideDataPageId(id: string): boolean {
  return id === GUIDE_ORDERS_ID || id === GUIDE_PRODUCTS_ID
}

export function buildGuideDataPages(spaceId: string): Page[] {
  const now = new Date().toISOString()
  return [
    {
      id: GUIDE_ORDERS_ID,
      spaceId,
      folderId: null,
      title: 'orders',
      type: 'csv',
      content: GUIDE_ORDERS_CSV,
      description: '',
      icon: 'ShoppingBag',
      iconColor: 'sage',
      sortOrder: 0,
      archived: false,
      createdAt: now,
      updatedAt: now
    },
    {
      id: GUIDE_PRODUCTS_ID,
      spaceId,
      folderId: null,
      title: 'products',
      type: 'csv',
      content: GUIDE_PRODUCTS_CSV,
      description: '',
      icon: 'Package',
      iconColor: 'mint',
      sortOrder: 1,
      archived: false,
      createdAt: now,
      updatedAt: now
    }
  ]
}
