// builds a .txt to feed llvm from data taken from https://dummyjson.com/products?limit=1000

import { readFileSync, writeFileSync } from "fs";

const data = JSON.parse(readFileSync('assets/100Products.json').toString())
function printField(p:any, k:string, ) {
  if(p[k]){
    const name = k.substring(0, 1).toUpperCase()+k.substring(1)
    return `${name}: ${p[k]}`
  }
}
// ${data.products.map(p=>`'Name: ${p.title}. Description: ${p.description}. Price: ${p.discountPercentage}. Discount: ${p.discountPercentage}. Rating: ${p.rating}. Stock: ${p.stock}. Brand: ${p.brand}. Category: ${p.category}'`).join(',\n  ')}
const s = data.products.map(p=>`${['title', 'description', 'price', 'discountPercentage', 'rating', 'stock', 'brand', 'category'].map(key=>printField(p, key)).join('. ')}`).join('\n')
writeFileSync('assets/100Products.txt', s)