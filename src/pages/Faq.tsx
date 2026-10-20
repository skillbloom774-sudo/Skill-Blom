import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { SUPPORT_EMAIL, SUPPORT_REPLY_TIME } from '../lib/site'

type Item = { question: string; answer: string }
type Group = { title: string; items: Item[] }

const GROUPS: Group[] = [
  {
    title: 'Getting started',
    items: [
      {
        question: 'How do I sign up?',
        answer:
          'Create an account with your email and a password, then confirm your email from the link we send. Once confirmed, sign in to see your dashboard.',
      },
      {
        question: "I didn't get the confirmation email. What do I do?",
        answer:
          'Check your spam or promotions folder first. If it isn\'t there, go back to the sign-in page and use "Resend confirmation email". Wait a minute between attempts.',
      },
      {
        question: 'I forgot my password.',
        answer:
          'Use "Forgot password?" on the sign-in page. We\'ll send a reset link to your email. The link is valid for a limited time, so use it soon after requesting it.',
      },
    ],
  },
  {
    title: 'Sessions and access',
    items: [
      {
        question: 'What am I buying?',
        answer:
          'You buy access to one live session for one month. It includes the live meeting, the classwork, assignments and tests from your guest teacher, and the class chat.',
      },
      {
        question: 'Is it a subscription?',
        answer:
          'No. Payment is one-time. It does not renew automatically. To attend the next month, you buy that session again.',
      },
      {
        question: 'How long does my access last?',
        answer:
          'Until the access end date shown on the session page, which is normally the end of the month. You can still open your materials until then.',
      },
      {
        question: 'When can I join the session?',
        answer:
          'The join button appears in your session room 15 minutes before the start time, and stays available for a while after the session ends.',
      },
      {
        question: 'Will I get reminders?',
        answer:
          'Yes. We email you 24 hours and 15 minutes before each session you have access to.',
      },
    ],
  },
  {
    title: 'Payments and refunds',
    items: [
      {
        question: 'How do I pay?',
        answer:
          'Payments are processed securely by Paystack. You receive a receipt by email once payment is confirmed.',
      },
      {
        question: 'I paid but my access hasn\'t appeared.',
        answer:
          'Access is confirmed automatically, and it can take a few minutes. Check your dashboard, and check your email for a receipt. If it still hasn\'t appeared after 15 minutes, contact us with your payment email.',
      },
      {
        question: 'Can I get a refund?',
        answer:
          'Yes, if you ask before the session starts. Open the session on your dashboard and choose "Request refund". Read the full rules in our Refund Policy.',
      },
      {
        question: 'What if a session is cancelled?',
        answer:
          'Every paying student is refunded in full, and you will be emailed when the refund is sent.',
      },
      {
        question: 'Do you have discount codes?',
        answer:
          'Sometimes. If you have a code, enter it on the session page before you pay. The discounted price is shown before you confirm.',
      },
    ],
  },
  {
    title: 'In the session',
    items: [
      {
        question: 'Is the session on Zoom or Google Meet?',
        answer:
          'It depends on the session. The join button in your room says which platform the teacher is using.',
      },
      {
        question: 'Can I ask questions without speaking up?',
        answer:
          'Yes. In the class chat, tick "Send anonymously" to hide your name from other students. Your teacher can still see who sent it. You can also message your teacher privately.',
      },
      {
        question: 'Can I submit assignments and take tests online?',
        answer:
          'Yes. Assignments accept text and files of any type. Tests can include multiple choice, short answers, longer answers, and file uploads. Multiple-choice answers are marked straight away, and your teacher marks the rest.',
      },
    ],
  },
  {
    title: 'Your account',
    items: [
      {
        question: 'Can I change my name or phone number?',
        answer: 'Yes. Open "Your details" from the menu at the top right of the site.',
      },
      {
        question: 'How do I delete my account?',
        answer:
          'Open "Your details", scroll to "Close account", and follow the steps. Your payment records are kept for the period Nigerian financial rules require, but your name and contact details are removed from them.',
      },
    ],
  },
]

export default function Faq() {
  return (
    <section className="container-page py-14 sm:py-20">
      <PageHeader
        eyebrow="Help"
        title="Frequently asked questions"
        description="Quick answers about signing up, sessions, payments, and refunds. Can't find what you need? Contact us below."
      />

      <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_20rem] lg:gap-16">
        <div className="grid gap-12">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="text-2xl">{group.title}</h2>
              <div className="mt-5 divide-y divide-brand-border border-y border-brand-border">
                {group.items.map((item) => (
                  <details key={item.question} className="group py-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-[15px] font-medium text-brand-text">
                      {item.question}
                      <span
                        aria-hidden
                        className="shrink-0 text-brand-muted transition group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-3 max-w-prose leading-relaxed text-brand-muted">{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="card">
            <p className="eyebrow">Contact us</p>
            <h2 className="mt-3 text-xl">Still need help?</h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-muted">
              Email us from the address you signed up with, and include the session name and what you were trying
              to do. We reply {SUPPORT_REPLY_TIME}.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Skillbloom%20help`}
              className="btn-primary mt-6 w-full"
            >
              Email {SUPPORT_EMAIL}
            </a>
          </div>

          <div className="card mt-6 text-sm leading-relaxed text-brand-muted">
            <p className="font-medium text-brand-text">Before you email</p>
            <ul className="mt-3 grid list-disc gap-2 pl-5">
              <li>Check your spam folder for our emails.</li>
              <li>Look at your dashboard, where your sessions and access card are listed.</li>
              <li>
                Read our{' '}
                <Link to="/refunds" className="text-brand-primary underline">Refund Policy</Link> for refund
                questions.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  )
}