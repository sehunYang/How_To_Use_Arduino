import { useState, type ReactNode } from 'react'

export function Checklist({ items }: { items: ReactNode[] }) {
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false))
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index}>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={checked[index]}
              onChange={(event) => {
                setChecked((current) => current.map((value, itemIndex) => (
                  itemIndex === index ? event.target.checked : value
                )))
              }}
            />
            {item}
          </label>
        </li>
      ))}
    </ul>
  )
}
