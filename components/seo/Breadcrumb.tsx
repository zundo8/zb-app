import Link from 'next/link'
import { BreadcrumbJsonLd } from './BreadcrumbJsonLd'

interface BreadcrumbProps {
  items: { name: string; url: string }[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <>
      <BreadcrumbJsonLd items={items} />
      <nav aria-label="Breadcrumb" className="breadcrumb-nav hidden md:block">
        <ol
          itemScope
          itemType="https://schema.org/BreadcrumbList"
          style={{ display: 'flex', gap: '0.5rem', listStyle: 'none', padding: 0, margin: 0, flexWrap: 'wrap' }}
        >
          {items.map((item, index) => (
            <li
              key={item.url}
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {index < items.length - 1 ? (
                <>
                  <Link
                    href={item.url}
                    itemProp="item"
                    style={{ fontSize: '0.75rem', opacity: 0.6 }}
                  >
                    <span itemProp="name">{item.name}</span>
                  </Link>
                  <span aria-hidden="true" style={{ opacity: 0.4 }}>/</span>
                </>
              ) : (
                <span itemProp="name" style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                  {item.name}
                </span>
              )}
              <meta itemProp="position" content={String(index + 1)} />
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}
