import { createElement } from 'inferno-create-element'
import "reflect-metadata"

export function editable(target?: any, propertyKey?: string) {
  let properties: string[] = Reflect.getMetadata("editableProperties", target) || []
  if (properties.indexOf(propertyKey!) < 0) {
    properties.push(propertyKey!)
  }

  Reflect.defineMetadata("editableProperties", properties, target)
}

export function label(name: string) {
  return function(target: any, propertyKey: string) {
    Reflect.defineMetadata("editablePropertiesLabel", name, target, propertyKey)
  }
}

export function element(name: 'input' | 'textarea') {
  return function(target: any, propertyKey: string) {
    debugger
    Reflect.defineMetadata('editablePropertiesElement', name, target, propertyKey)
  }
}

export function defaultValue(value: any) {
  return function(target: any, propertyKey: string) {
    debugger
    Reflect.defineMetadata('editablePropertiesValue', value, target, propertyKey)
  }
}

export interface Property { name: string, type: any, label: string, element: string, defaultValue: any }

export function generateForm2<T = any>(obj: any, onChange: (v: Property & { value: T, data: any }) => void) {
  const p = Reflect.getMetadata("editableProperties", obj)
  debugger
  let properties: Property[] = (p || []).map((property: string) => ({
    name: property,
    type: Reflect.getMetadata("design:type", obj, property) || String,
    label: Reflect.getMetadata("editablePropertiesLabel", obj, property) || property,
    element: Reflect.getMetadata("editablePropertiesElement", obj, property) || 'input',
    defaultValue: Reflect.getMetadata("editablePropertiesValue", obj, property) || null,
  }))

  return properties.map(p => <label>{p.label}

    {p.element === 'input' ? <input defaultValue={obj[p.name]} type={p.type === String ? 'text' : p.type === Date ? 'date' : p.type === Boolean ? 'checkbox' : p.type === Number ? 'number' : 'text'} onChange={e => onChange({ ...p, value: e.currentTarget.value as any, data: { [p.name]: e.currentTarget.value } })} /> :

      p.element === 'textarea' ? <textarea defaultValue={obj[p.name]} onChange={e => onChange({ ...p, value: e.currentTarget.value as any, data: { [p.name]: e.currentTarget.value } })}></textarea> : ''
    }
  </label>)
}
