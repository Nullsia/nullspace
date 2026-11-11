import { type FormEvent, type ReactNode } from "react";
import "./EnglishPages.css";
import { Lines } from "../components/Lines";

const email = "seunghoon.lee@null-space.io";

const newsItems = [
  {
    slug: "cfd-containment-200-racks",
    category: "Technical note",
    title: "Exploring containment with a 200-rack virtual layout",
    description: "Looking at data center cooling scenarios through CFD simulation.",
  },
  {
    slug: "hd-hhi-cooling-pilot",
    category: "Joint pilot",
    title: "A joint pilot with HD Hyundai Heavy Industries for cooling power optimization",
    description: "Exploring new possibilities for data center cooling operations together.",
  },
];

const careers = [
  {
    slug: "ai-engineer",
    title: "AI Engineer",
    deadline: "2026.9.18",
    category: "Engineering",
    overview: "A role exploring complex on-site challenges through data and models.",
  },
  {
    slug: "founding-designer",
    title: "Founding Designer",
    deadline: "2026.9.15",
    category: "Design",
    overview: "A role shaping product and brand experiences through a consistent vision.",
  },
];

const faqs = [
  {
    question: "What can I contact you about?",
    answer: "You can contact Null Space about solution adoption, joint pilots, investment and IR materials, partnerships, and more.",
  },
  {
    question: "How do we begin an adoption project or pilot?",
    answer: "Tell us briefly about your current operating environment and the challenges you are interested in. Based on your inquiry, we can explore possible next steps together.",
  },
  {
    question: "Does Scenario Lab use real on-site data?",
    answer: "Scenario Lab is a CFD demo based on a 200-rack virtual layout. It has not yet been validated against on-site measurements and does not guarantee actual performance.",
  },
  {
    question: "Can I request investment or IR materials?",
    answer: "Select ‘Investment / IR materials’ as the inquiry type and include your organization and request.",
  },
  {
    question: "Are partnerships or joint research possible?",
    answer: "Yes. We welcome partners who would like to share on-site challenges and ideas for collaboration. Please tell us about your area of interest.",
  },
  {
    question: "How is the inquiry form delivered?",
    answer: "Once you complete the required fields, an email draft will open. Please review it and send it yourself from your email app.",
  },
];

function PageIntro({ title, description, graphic = false }: { title: ReactNode; description: ReactNode; graphic?: boolean }) {
  return (
    <section className="en-intro">
      <div className="en-intro-copy">
        <h1>{title}</h1>
        <p><Lines>{description}</Lines></p>
      </div>
      {graphic && (
        <div className="en-wireframe" aria-hidden="true">
          <div className="en-wireframe-ring en-ring-one" />
          <div className="en-wireframe-ring en-ring-two" />
          <div className="en-wireframe-ring en-ring-three" />
        </div>
      )}
    </section>
  );
}

function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="en-arrow-link" href={href}><span>{children}</span><span aria-hidden="true">↗</span></a>;
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="en-text-link" href={href}><span>{children}</span><span aria-hidden="true">↗</span></a>;
}

function InquiryCTA({ heading = <>Let’s discover possibilities<br />we couldn’t see before.</> }: { heading?: ReactNode }) {
  return <section className="en-cta"><h2>{heading}</h2><ArrowLink href="/en/contact">Contact us</ArrowLink></section>;
}

function ScenarioGraphic() {
  return (
    <div className="en-scenario-graphic" role="img" aria-label="Illustration of a 200-rack virtual layout">
      <div className="en-map" aria-hidden="true">
        <div className="en-rack-grid">
          {Array.from({ length: 200 }, (_, index) => <span key={index} className={index % 31 === 0 || index % 47 === 0 ? "en-rack en-rack-active" : "en-rack"} />)}
        </div>
      </div>
    </div>
  );
}

export function EnglishNewsPage() {
  return (
    <div className="en-page en-news" lang="en">
      <PageIntro title={<>Our perspective.<br /><span>Our latest news.</span></>} description={<>Updates on the changes Null Space is making and the insights we discover along the way.</>} />
      <section className="en-section en-news-section">
        <div className="en-list-heading"><h2>All news</h2></div>
        <div className="en-news-list">
          {newsItems.map(item => (
            <a href={`/en/news/${item.slug}`} className="en-news-item" key={item.slug}>
              <div className="en-category">{item.category}</div>
              <div><h3>{item.title}</h3><p><Lines>{item.description}</Lines></p></div>
              <span className="en-news-arrow" aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </section>
      <InquiryCTA />
    </div>
  );
}

function ArticleShell({ category, title, children }: { category: string; title: string; children: ReactNode }) {
  return (
    <div className="en-page en-detail" lang="en">
      <section className="en-detail-hero">
        <div className="en-detail-meta"><a href="/en/news">← &nbsp; News</a><span className="en-category">{category}</span></div>
        <h1>{title}</h1>
      </section>
      <article className="en-article">{children}</article>
      <div className="en-section en-detail-back"><a className="en-text-link" href="/en/news">← &nbsp; View all news</a></div>
      <InquiryCTA />
    </div>
  );
}

function currentSlug() {
  return typeof window === "undefined" ? "" : window.location.pathname.split("/").filter(Boolean).pop() || "";
}

export function EnglishNewsDetailPage() {
  const slug = currentSlug();
  if (slug === "cfd-containment-200-racks") {
    return (
      <ArticleShell category="Technical note" title="Exploring containment with a 200-rack virtual layout">
        <p className="en-article-lead"><Lines>The journey toward a better data center begins with understanding how air flows.</Lines></p>
        <ScenarioGraphic />
        <h2>Questions that begin in a virtual space</h2>
        <p><Lines>A data center’s cooling environment is connected to many factors, including rack layout, airflow and the shape of the space. Containment is one approach to examining the cooling environment by separating cold and warm airflows.</Lines></p>
        <p><Lines>Scenario Lab is a CFD demo that explores different conditions using a 200-rack virtual layout. It offers a visual starting point for understanding the complexity of real-world environments.</Lines></p>
        <div className="en-callout"><strong>Note</strong><p><Lines>This demo is based on a virtual layout. It has not yet been validated against on-site measurements and does not imply any specific performance or savings.</Lines></p></div>
        <h2>From simulation to the field</h2>
        <p><Lines>Actual implementation requires further review and validation based on on-site conditions and data. Null Space values the process of connecting hypotheses with observation and real-world testing.</Lines></p>
        <TextLink href="/en/solution">Explore our solution</TextLink>
      </ArticleShell>
    );
  }
  if (slug === "hd-hhi-cooling-pilot") {
    return (
      <ArticleShell category="Joint pilot" title="A joint pilot with HD Hyundai Heavy Industries for cooling power optimization">
        <p className="en-article-lead"><Lines>Together, we are exploring the potential to optimize data center cooling power in the field.</Lines></p>
        <div className="en-article-feature"><span>Joint pilot · 2026.09 — 2027.03</span><strong>HD HYUNDAI<br />HEAVY INDUSTRIES <span>×</span><br />NULL SPACE</strong></div>
        <h2>The next step, together</h2>
        <p><Lines>Null Space is conducting a joint pilot with HD Hyundai Heavy Industries to optimize data center cooling power. The pilot period runs from September 2026 to March 2027.</Lines></p>
        <p><Lines>This collaboration is a process of gaining a deeper understanding of cooling operations based on on-site conditions and exploring applicable approaches together. Specific results must be confirmed through the pilot and subsequent review.</Lines></p>
        <div className="en-callout"><strong>Pilot period</strong><p><Lines>2026.09 — 2027.03<br />Joint pilot for data center cooling power optimization</Lines></p></div>
        <h2>Connecting the field and technology</h2>
        <p><Lines>New possibilities open up when different areas of expertise come together. Null Space continues to collaborate with others to define and validate real-world challenges.</Lines></p>
        <TextLink href="/en/contact">Ask about collaboration</TextLink>
      </ArticleShell>
    );
  }
  return <div className="en-page" lang="en"><section className="en-empty"><h1>News article not found.</h1><ArrowLink href="/en/news">Back to news</ArrowLink></section></div>;
}

export function EnglishCareersPage() {
  return (
    <div className="en-page en-careers" lang="en">
      <PageIntro title={<>People who ask<br /><span>better questions together.</span></>} description={<>In the face of problems without easy answers, we explore and learn together to build better infrastructure.</>} graphic />
      <section className="en-section en-career-open">
        <h2>There are no open<br />positions at this time.</h2>
        <div><p><Lines>Interested in working with Null Space? Feel free to email us with questions or ideas for collaboration.</Lines></p><TextLink href={`mailto:${email}`}>{email}</TextLink></div>
      </section>
      <section className="en-section en-career-archive">
        <div className="en-list-heading"><h2>Past openings</h2></div>
        <div className="en-archive-list">
          {careers.map(career => (
            <details className="en-archive-item" key={career.slug}>
              <summary><span className="en-category">{career.category}</span><strong>{career.title}</strong><span className="en-closed">Closed</span><span className="en-summary-plus" aria-hidden="true">+</span></summary>
              <div className="en-archive-content"><p><Lines>{career.overview}</Lines></p><p><Lines>Deadline: {career.deadline}</Lines></p><TextLink href={`/en/careers/${career.slug}`}>View position details</TextLink></div>
            </details>
          ))}
        </div>
      </section>
      <InquiryCTA heading={<>We look forward to<br />the next opportunity to connect.</>} />
    </div>
  );
}

export function EnglishCareerDetailPage() {
  const career = careers.find(item => item.slug === currentSlug());
  if (!career) return <div className="en-page" lang="en"><section className="en-empty"><h1>Position not found.</h1><ArrowLink href="/en/careers">Back to careers</ArrowLink></section></div>;
  return (
    <div className="en-page en-job-detail" lang="en">
      <section className="en-detail-hero">
        <div className="en-detail-meta"><a href="/en/careers">← &nbsp; Careers</a><span className="en-category">{career.category}</span></div>
        <span className="en-job-closed">Closed</span>
        <h1>{career.title}</h1>
        <div className="en-detail-rule">Deadline: {career.deadline}</div>
      </section>
      <article className="en-article">
        <p className="en-article-lead"><Lines>{career.overview}</Lines></p>
        <div className="en-callout"><strong>Applications closed</strong><p><Lines>This position closed on {career.deadline}. We are not currently accepting applications.</Lines></p></div>
        <h2>About the role</h2>
        <p><Lines>{career.slug === "ai-engineer" ? "The role focuses on connecting data and software with real-world challenges. It involves understanding problems from different perspectives and exploring possibilities through experimentation." : "The role focuses on turning complex problems into clear experiences and thinking about consistent, useful experiences across product and brand."}</Lines></p>
        <p className="en-muted"><Lines>This is a general introduction to the role, not an announcement of an active opening.</Lines></p>
        <h2>Connecting with Null Space</h2>
        <p><Lines>If you have questions about the team or future opportunities, please email us.</Lines></p>
        <TextLink href={`mailto:${email}`}>{email}</TextLink>
      </article>
      <div className="en-section en-detail-back"><a className="en-text-link" href="/en/careers">← &nbsp; View all positions</a></div>
      <InquiryCTA />
    </div>
  );
}

export function EnglishContactPage() {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    for (const fieldName of ["name", "company", "message"]) {
      const field = form.elements.namedItem(fieldName) as HTMLInputElement | HTMLTextAreaElement | null;
      if (field) field.setCustomValidity(field.value.trim() ? "" : "Please complete this field.");
    }
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const get = (name: string) => String(data.get(name) || "").trim();
    const subject = `[Null Space Inquiry] ${get("type")}`;
    const body = `Name: ${get("name")}\nCompany / organization: ${get("company")}\nEmail: ${get("email")}\nPhone: ${get("phone") || "Not provided"}\nInquiry type: ${get("type")}\nConsent to provide personal information: Yes\n\nMessage:\n${get("message")}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  function clearCustomValidity(event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) {
    event.currentTarget.setCustomValidity("");
  }
  return (
    <div className="en-page en-contact" lang="en">
      <PageIntro title={<>What possibilities<br /><span>are you looking for?</span></>} description={<>From adoption and pilots to new collaborations, start a conversation with Null Space.</>} />
      <section className="en-section en-contact-layout">
        <div className="en-contact-side">
          <h2>Frequently asked<br />questions.</h2>
          <p><Lines>Answers to questions you may have before getting in touch.</Lines></p>
          <div className="en-faq-list">
            {faqs.map(faq => <details className="en-faq" key={faq.question}><summary><strong>{faq.question}</strong><span className="en-summary-plus" aria-hidden="true">+</span></summary><p><Lines>{faq.answer}</Lines></p></details>)}
          </div>
        </div>
        <div className="en-form-panel">
          <h2>How can we<br />help you?</h2>
          <p className="en-form-intro"><Lines>Complete the form below to open an email draft. Please review and send it yourself.</Lines></p>
          <p className="en-required-note"><Lines><span aria-hidden="true">*</span> Required fields</Lines></p>
          <form onSubmit={handleSubmit} className="en-contact-form">
            <div className="en-form-row">
              <label>Name <span aria-hidden="true">*</span><input name="name" autoComplete="name" required onInput={clearCustomValidity} placeholder="Your name" /></label>
              <label>Company / organization <span aria-hidden="true">*</span><input name="company" autoComplete="organization" required onInput={clearCustomValidity} placeholder="Company or organization" /></label>
            </div>
            <div className="en-form-row">
              <label>Email <span aria-hidden="true">*</span><input name="email" type="email" autoComplete="email" required placeholder="name@company.com" /></label>
              <label>Phone <small>Optional</small><input name="phone" type="tel" autoComplete="tel" placeholder="Your phone number" /></label>
            </div>
            <label>Inquiry type <span aria-hidden="true">*</span><select name="type" defaultValue="" required><option value="" disabled>Select an inquiry type</option><option>Adoption / pilot</option><option>Investment / IR materials</option><option>Partnership</option><option>Other</option></select></label>
            <label>Message <span aria-hidden="true">*</span><textarea name="message" required onInput={clearCustomValidity} rows={6} placeholder="Tell us about your inquiry." /></label>
            <div className="en-privacy">
              <p><Lines>The information you enter is used to create an email draft. This website does not automatically save or send your inquiry.</Lines></p>
              <label className="en-check"><input type="checkbox" name="consent" required /><span>I consent to providing personal information for handling this inquiry. <b aria-hidden="true">*</b></span></label>
            </div>
            <button type="submit" className="en-form-submit"><span>Create email draft</span><span aria-hidden="true">↗</span></button>
            <p className="en-form-note"><Lines>Please review and send the email yourself from your email app.</Lines></p>
          </form>
        </div>
      </section>
      <section className="en-contact-direct"><div><span>Email us directly</span><a href={`mailto:${email}`}>{email} <span aria-hidden="true">↗</span></a></div></section>
    </div>
  );
}
