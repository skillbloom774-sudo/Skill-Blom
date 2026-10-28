import { Link } from 'react-router-dom'

type Section = { heading: string; body: string[] }
type Doc = { eyebrow: string; title: string; updated: string; intro: string; sections: Section[] }

const DOCS: Record<'terms' | 'privacy' | 'refunds', Doc> = {
  terms: {
    eyebrow: 'Legal',
    title: 'Terms of Service',
    updated: 'Draft, October 2026',
    intro:
      'These terms apply when you create a Skillbloom account or buy access to a session. Please read them before you pay.',
    sections: [
      {
        heading: 'What Skillbloom provides',
        body: [
          'Skillbloom runs live online sessions in design and technology, taught by guest teachers. Each session is sold as a one-month purchase and includes a live meeting, materials, assignments, tests, and a class chat.',
        ],
      },
      {
        heading: 'Your account',
        body: [
          'You must give accurate details when you sign up and keep your password private. You are responsible for activity on your account.',
        ],
      },
      {
        heading: 'Buying access',
        body: [
          'A payment gives you access to one session until the access end date shown on the session page. It is not a subscription and does not renew automatically. To attend the next month, you buy that session again.',
        ],
      },
      {
        heading: 'Changes and cancellations',
        body: [
          'We may change session details, such as time or teacher, and will tell you by email if we do. If we cancel a session, we will refund you in full.',
        ],
      },
      {
        heading: 'Personal use only',
        body: [
          'Your access is for you alone. Do not share meeting links, access cards, or materials, and do not record a session or its chat without the consent of everyone in it.',
        ],
      },
      {
        heading: 'Chat and conduct',
        body: [
          'Be respectful. Harassment, hate speech, spam, and sharing other people\'s personal information are not allowed. We may remove messages and suspend accounts that break these rules.',
        ],
      },
      {
        heading: 'Teacher materials',
        body: [
          'Classwork, assignments, tests, and other materials belong to the guest teacher or Skillbloom. You may use them for your own learning, but not copy, resell, or publish them.',
        ],
      },
      {
        heading: 'Payments',
        body: [
          'Payments are processed by Paystack. Discount codes are valid only for the sessions and limits shown when you apply them.',
        ],
      },
      {
        heading: 'Governing law',
        body: [
          'These terms are governed by the laws of the Federal Republic of Nigeria.',
        ],
      },
      {
        heading: 'Contact',
        body: ['Questions about these terms: Message (skillbloom774@gmail.com).'],
      },
    ],
  },
  privacy: {
    eyebrow: 'Legal',
    title: 'Privacy Notice',
    updated: 'Draft, October 2026',
    intro:
      'This notice explains what personal data Skillbloom collects, why, and what your rights are under the Nigeria Data Protection Act 2023.',
    sections: [
      {
        heading: 'What we collect',
        body: [
          'Account details: name, email address, and phone number.',
          'Learning data: sessions you buy, submissions, test answers, scores, feedback, and chat messages.',
          'Payment records: amount, date, and a payment reference. We do not store your card details. Paystack handles those.',
          'Technical data: basic logs needed to keep the site secure and working.',
        ],
      },
      {
        heading: 'Why we use it',
        body: [
          'To provide your account, sessions, and access card, take payments, send receipts and reminders, support you, keep the platform safe, and meet legal record-keeping duties.',
        ],
      },
      {
        heading: 'Who sees your information',
        body: [
          'Guest teachers see the names and submissions of students in their own sessions. Anonymous chat questions show your name to your teacher and to admins.',
          'We share data with service providers who help us run Skillbloom: Supabase (database and storage), Paystack (payments), and our email providers for receipts and reminders. Meetings run on Zoom or Google Meet, under their own policies.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          'Account and learning records are kept while your account is active. Payment records are kept for the period required by Nigerian financial rules. You can ask us to delete your account at any time, and we will delete what we are not required to keep.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          'You can ask to see, correct, or delete your personal data, and to object to or restrict how we use it. To exercise these rights, contact us at the address below. We will respond within the time the law allows.',
        ],
      },
      {
        heading: 'Security',
        body: [
          'Your data is stored with access rules so students only see their own information. Payment confirmations are checked on our servers, not in the browser.',
        ],
      },
      {
        heading: 'Children',
        body: [
          'Skillbloom is for people aged 18 and over. If you are under 18, please use the platform with a parent or guardian who agrees to these terms.',
        ],
      },
      {
        heading: 'Contact',
        body: ['Data protection questions: hello@skillbloom.example (replace with your real contact email).'],
      },
    ],
  },
  refunds: {
    eyebrow: 'Legal',
    title: 'Refund Policy',
    updated: 'Draft, October 2026',
    intro: 'This policy explains when you can get your money back for a Skillbloom session.',
    sections: [
      {
        heading: 'Before the session starts',
        body: [
          'You can request a full refund for any session until it starts. Go to My learning, choose the session, and select Request refund. Tell us why, and the admin will review it.',
        ],
      },
      {
        heading: 'After the session starts',
        body: [
          'Refunds are not usually given once a session has started, because the session has been delivered. We will still look at cases where you were unable to attend because of a fault on our side, and decide each one fairly.',
        ],
      },
      {
        heading: 'Cancelled sessions',
        body: [
          'If we cancel a session, every paying student receives a full refund. You will be told by email.',
        ],
      },
      {
        heading: 'How refunds are paid',
        body: [
          'Refunds go back to the original payment method through Paystack. Your bank or card provider may take a few working days to show the credit. If you used a discount code, the refund is for the amount you actually paid.',
        ],
      },
      {
        heading: 'Access after a refund',
        body: [
          'When a refund is issued, your access to that session ends straight away.',
        ],
      },
    ],
  },
}

export default function Legal({ doc }: { doc: 'terms' | 'privacy' | 'refunds' }) {
  const d = DOCS[doc]

  return (
    <section className="container-page py-14 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">{d.eyebrow}</p>
        <h1 className="mt-3 text-4xl sm:text-5xl">{d.title}</h1>
        <p className="mt-4 text-sm text-brand-muted">Last updated: {d.updated}</p>
        <p className="mt-8 text-lg leading-relaxed text-brand-text">{d.intro}</p>

        <div className="mt-12 grid gap-10">
          {d.sections.map((s) => (
            <div key={s.heading}>
              <h2 className="text-2xl">{s.heading}</h2>
              <div className="mt-4 grid gap-4">
                {s.body.map((p) => (
                  <p key={p} className="leading-relaxed text-brand-text">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap gap-6 border-t border-brand-border pt-8 text-sm">
          {doc !== 'terms' && <Link to="/terms" className="text-brand-muted hover:text-brand-primary">Terms</Link>}
          {doc !== 'privacy' && <Link to="/privacy" className="text-brand-muted hover:text-brand-primary">Privacy</Link>}
          {doc !== 'refunds' && <Link to="/refunds" className="text-brand-muted hover:text-brand-primary">Refunds</Link>}
        </div>
      </div>
    </section>
  )
}