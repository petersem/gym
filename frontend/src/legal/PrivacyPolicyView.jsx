import { useNavigate } from "react-router";
import { FaArrowLeft } from "react-icons/fa";

const SECTIONS = [
  {
    title: "Information We Collect",
    content: (
      <>
        <p>Depending on how you use the app, we may collect:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            Account and contact details, such as your name, email address, phone
            number, date of birth and login information.
          </li>
          <li>
            Gym service details, such as bookings, session attendance and
            activity preferences.
          </li>
          <li>Blog posts and other information you submit through forms.</li>
          <li>
            Basic technical information needed to operate and secure the app.
          </li>
        </ul>
        <p>
          Please do not submit sensitive health or financial information through
          general text fields.
        </p>
      </>
    ),
  },
  {
    title: "How We Use Information",
    content: (
      <p>
        We use personal information to manage accounts, provide gym services and
        bookings, respond to enquiries, maintain and secure the app, and meet
        legal obligations. We will use information for other purposes only where
        permitted by law and, when required, with your consent.
      </p>
    ),
  },
  {
    title: "When We Share Information",
    content: (
      <>
        <p>
          We may share information with service providers that help us operate
          the app and provide our services. They may use it only to perform
          services for us and as permitted by law. We may also disclose
          information when required by law or to protect people, rights, or the
          security of our services.
        </p>
        <p>
          [Describe whether your business sells or shares personal information
          for advertising, and update this policy to match your actual
          practices.]
        </p>
      </>
    ),
  },
  {
    title: "Browser Storage",
    content: (
      <p>
        When you log in, the app stores an access key in your browser&apos;s
        local storage so you stay signed in, and it may also store your theme
        preference. Logging out removes the access key. You can clear browser
        storage through your browser settings; you will need to log in again
        afterwards.
      </p>
    ),
  },
  {
    title: "Retention and Security",
    content: (
      <p>
        We keep personal information only as long as reasonably necessary for
        the purposes described in this policy, unless a longer period is
        required by law. We use reasonable safeguards to protect information,
        but no online service can guarantee complete security.
      </p>
    ),
  },
  {
    title: "Your Choices and Rights",
    content: (
      <p>
        Depending on where you live, you may have rights to request access to,
        correction of, or deletion of your personal information, or to object to
        certain uses. You can update your details at any time from your profile.
        Contact us using the details below for other requests. We may need to
        verify your identity before responding.
      </p>
    ),
  },
  {
    title: "Children's Privacy",
    content: (
      <p>
        Our services are not intended for children under [Minimum age]. We do
        not knowingly collect children&apos;s personal information without any
        consent required by law. Contact us if you believe a child has provided
        us with personal information.
      </p>
    ),
  },
  {
    title: "Changes and Contact",
    content: (
      <>
        <p>
          We may update this policy from time to time. We will post the revised
          policy here and update its effective date.
        </p>
        <p>
          Questions or privacy requests: contact High Street Gym at{" "}
          <a className="link link-primary" href="mailto:admin@example.com">
            [admin@example.com]
          </a>
          .
        </p>
      </>
    ),
  },
];

function PrivacyPolicyView() {
  const navigate = useNavigate();

  return (
    <article
      className="flex flex-col gap-4 p-4"
      aria-labelledby="privacy-title"
    >
      <div>
        <p className="text-sm opacity-60">Effective date: 2 October 2026</p>
        <h1 id="privacy-title" className="text-3xl">
          Privacy Policy
        </h1>
      </div>
      <p className="leading-relaxed">
        High Street Gym (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;)
        respects your privacy. This policy explains how we handle personal
        information when you use our app or interact with our gym.
      </p>
      {SECTIONS.map(({ title, content }) => (
        <section key={title} className="flex flex-col gap-2 leading-relaxed">
          <h2 className="text-lg font-bold">{title}</h2>
          {content}
        </section>
      ))}
      <button className="btn btn-ghost self-start" onClick={() => navigate(-1)}>
        <FaArrowLeft /> Back
      </button>
    </article>
  );
}

export default PrivacyPolicyView;
