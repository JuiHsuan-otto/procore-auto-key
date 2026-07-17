# Human Input Register

Status values are based on repository and public production evidence only. “Not obtained” does not mean the fact is absent.

| ID | Input | Obtained | Provider | Expected source | Verification | Affected pages | Schema | Blocks coding | Blocks publishing | Refresh | Risk |
|---|---|---|---|---|---|---|---|---|---|---|---|
| H01 | Legal company name | No | Business owner | registration document | match official registry/document | About/legal/footer | legalName/Organization | No | Yes | on change | High |
| H02 | Public brand name | No canonical decision | Business owner | written brand decision | compare site/social/GBP | all metadata/footer | name/alternateName | No | Yes for entity rollout | on change | High |
| H03 | Tax ID | No | Business owner/accountant | official registration | document check | legal/about | taxID | No | Yes if published | on change | High |
| H04 | Address/service locations | No | Business owner | lease/registration/GBP | address ownership and public-use approval | contact/location | PostalAddress | No | Yes | on change | High |
| H05 | Opening hours | No | Operations owner | approved operating schedule | compare actual coverage | contact/header/schema | openingHours | No | Yes | monthly/on change | High |
| H06 | Primary service area | No operational evidence | Operations owner | completed case/serviceability data | cases by area plus policy | area/service pages | areaServed | No | Yes | quarterly | High |
| H07 | 24H claim evidence | No | Operations owner | staffing/on-call records | sustained coverage review | homepage/CTA | openingHours | No | Yes | monthly | High |
| H08 | Cumulative service metrics | No | Operations/data owner | case ledger | deduplicated source count | homepage | interactionStatistic/custom display | No | Yes | defined cadence | High |
| H09 | Metric calculation definitions | No | Data owner | signed metric dictionary | reproducible calculation | homepage/reports | metric-dependent | No | Yes | on method change | High |
| H10 | Pricing model | Yes: case-by-case quotation; no fixed range | Business owner | confirmed operating policy | owner confirmation; future fixed pricing requires separate evidence | future pricing explainer/service | omit priceRange by default | No | No for factor-based explainer | on business-model change | Medium |
| H11 | Warranty policy | No | Business owner | approved written terms | scope/exclusions/effective date | future warranty/service | warranty-related | No | Yes | on change | High |
| H12 | Technician profiles | No | Each technician/owner | approved biography | identity and consent | future technician/about | Person | No | Yes | annually/on change | High |
| H13 | Certificates/training | No | Technician/issuer | certificate copy | issuer/date/scope validation | future technician/about | credential | No | Yes | on renewal | High |
| H14 | GBP URL | No | GBP owner | verified profile link | owner access/profile match | contact/entity | sameAs | No | Yes | on change | Medium |
| H15 | Google reviews | No export/permission | GBP owner | GBP review data | source, date, consent/use rules | future reviews | none by default | No | Yes | monthly | High |
| H16 | Social accounts | No canonical list | Business owner | account URLs | ownership/login confirmation | footer/contact | sameAs | No | Yes | quarterly | Medium |
| H17 | Case photo rights | Per-case unknown | Content owner/customer | consent or owner declaration | asset-to-case permission record | cases/articles | image | Yes for new case | Yes | per case | High |
| H18 | Privacy policy decisions | No | Business owner/legal adviser | approved policy | data-flow and local-law review | privacy/contact | none | No | Yes for new tracking | annually/on change | High |
| H19 | Washinmura owner/contract | No | Business owner/vendor owner | contract/authorization | purpose, roles, retention, deletion | five current pages/CSP | none | No | Yes for expansion/approval | annually/on change | High |
| H20 | Service response-time claim | No | Operations owner | timestamped lead/case data | percentile and coverage definition | CTA/service pages | none | No | Yes | quarterly | High |

Coding may create nullable schemas, validators, and unpublished records without these inputs. It may not turn missing inputs into public facts.
