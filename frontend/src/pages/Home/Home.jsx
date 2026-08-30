import React, { useRef } from 'react';
import { LuNetwork, LuUsers } from "react-icons/lu";
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import styles from './Home.module.css';
import Footer from '../../components/Footer/Footer.jsx';

// Sub-component: menampilkan banyak card
const Card = ({ title, desc, img, badge }) => (
  <div className={`${styles.cardContainer} group`}>
    <div className={styles.cardImageWrapper}>
      <img src={img} alt={title} className={styles.imageContent} />
      {badge && <span className={styles.cardBadge}>
        {badge}
      </span>}
    </div>
    <div className={styles.cardText}>
      <h3 className={styles.cardTitle}>
        {title}
      </h3>
      <p className={styles.cardDesc}>
        {desc}
      </p>
    </div>
  </div>
);

const galleryItems = [
  { 
    img: '/semara-ratih.webp', 
    title: 'Semara Ratih'
  },{
    img: '/prosesi-ngidih.webp',
    title: 'Prosesi Ngidih'
  },{ 
    img: '/perkawinan-bali.webp', 
    title: 'Prosesi Perkawinan Adat Bali' 
  },{ 
    img: '/keluarga-bali.webp', 
    title: 'Keluarga Adat Bali' 
  },{ 
    img: '/busana-bali.webp', 
    title: 'Busana Adat Bali' 
  }
];

const Home = () => {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.7;
      scrollRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className={styles.home}>
      <header className={styles.bannerHome}>
        <img src="/bn-kekerabatan.webp" alt="Sistem Kekerabatan Adat Bali" className={styles.bannerImg} />
        <div className={styles.bannerOverlay}/>
        <div className={styles.bannerContent}>
          <span className={styles.heroSub}>
            Kebudayaan & Hukum Adat
          </span>
          <p className={styles.heroDesc}>
            Mengenal tatanan silsilah Adat Bali, garis keturunan <i>Purusa-Predana</i>, serta struktur kekeluargaan Krama Bali.
          </p>
        </div>
      </header>
      <main className={styles.homeSection}>
        <section className={styles.sectionBlock}>
          <div className={styles.headerGroup}>
            <h2 className={styles.sectionTitle}>
              Sistem Silsilah Adat Bali
            </h2>
            <div className={styles.divider} />
          </div>
          <div className={styles.infoCardGrid}>
            <div className={styles.infoCard}>
              <div className={styles.infoCardIcon}>
                <LuNetwork className="w-6 h-6" />
              </div>
              <h3 className={styles.infoCardTitle}>
                Sistem Soroh & Keturunan
              </h3>
              <p className={styles.infoCardDesc}>
                Sistem silsilah Adat Bali mengatur tatanan sosial, budaya, dan keagamaan secara hierarkis. Dikenal dengan istilah <b><i>soroh</i></b> yang menarik garis keturunan <i>purusa</i> untuk menentukan identitas keluarga, hak (<i>swadikara</i>), serta kewajiban (<i>swadharma</i>).
              </p>
            </div>
            <div className={styles.infoCard}>
              <div className={styles.infoCardIcon}>
                <LuUsers className="w-6 h-6" />
              </div>
              <h3 className={styles.infoCardTitle}>
                Sistem Kekerabatan Patrilineal
              </h3>
              <p className={styles.infoCardDesc}>
                Masyarakat Adat Bali menganut sistem <i>patrilineal</i> yang didasarkan pada peran <i>purusa</i> (laki-laki) dan <i>predana</i> (perempuan). Dalam tata cara pembagian warisan, ajaran ini juga berpedoman pada kitab suci <b>Manawa Dharmasastra</b>.
              </p>
            </div>
          </div>
        </section>
        {/* Gallery Carousel */}
        <section className={styles.carouselContainer}>
          <button onClick={() => scroll('left')} className={`${styles.scrollBtn} ${styles.btnLeft}`} aria-label="Scroll Left">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div ref={scrollRef} className={styles.galleryTrack}>
            {galleryItems.map((item, index) => (
              <div key={index} className={`${styles.galleryCard} group`}>
                <img src={item.img} alt={item.title} className={styles.galleryImg}/>
                <div className={styles.galleryCaption}>
                  {item.title}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => scroll('right')} className={`${styles.scrollBtn} ${styles.btnRight}`} aria-label="Scroll Right">
            <ChevronRight className="w-6 h-6" />
          </button>
        </section>
        <section className={styles.sectionBlock}>
          <div className={styles.headerGroup}>
            <h2 className={styles.sectionTitle}>
              Perkawinan Adat Bali
            </h2>
            <div className={styles.divider} />
          </div>
          <blockquote className={styles.quoteBox}>
            <Quote className={styles.quoteIcon} />
            <p className={styles.quoteText}>
              "<i>Purusa</i> dan <i>predana</i> melambangkan <b><i>purusa-prakriti</i></b> — hubungan antara <i>jiwatman</i> yang kekal dengan badan kasar. Konsep ini menjadi landasan utama dalam 3 bentuk perkawinan adat."
            </p>
          </blockquote>
          <div className={styles.cardKhusus}>
            <Card 
              title="Perkawinan Biasa"
              badge="Patrilineal"
              desc="Perkawinan Adat Bali yang dimana istri ikut ke rumah suami yang berstatus purusa pada perkawinan mereka."
              img="/perkawinan-1.webp" 
            />
            <Card 
              title="Perkawinan Nyentana"
              badge="Matrilokal"
              desc="Perkawinan Adat Bali yang dimana suami ikut ke rumah istri yang berstatus purusa. Suami menjadi tanggung jawab dari keluarga istri."
              img="/perkawinan-2.webp" 
            />
            <Card 
              title="Perkawinan Pade Gelahang"
              badge="Kemitraan"
              desc="Perkawinan yang dimana suami dan istri terus hidup sebagai keturunan dari keluarga masing-masing dan melaksanakan tugas bersama."
              img="/perkawinan-3.webp" 
            />
          </div>
          <div className={styles.tradisiWrapper}>
            <h3 className={styles.subHeading}>
              Ragam Cara Perkawinan Adat Bali
            </h3>
            <div className={styles.tradisiGrid}>
              <div className={styles.tradisiCard}>
                <h4>Memadik (Meminang)</h4>
                <p>Perkawinan atas dasar suka sama suka yang didahului adanya lamaran resmi dari pihak laki-laki terhadap pihak perempuan.</p>
              </div>
              <div className={styles.tradisiCard}>
                <h4>Ngerorod (Lari Bersama)</h4>
                <p>Perkawinan atas dasar suka sama suka tanpa lamaran resmi karena belum ada persetujuan orang tua sehingga jalan lari bersama.</p>
              </div>
              <div className={styles.tradisiCard}>
                <h4>Melegandang (Tradisi Lampau)</h4>
                <p>Tata cara perkawinan masa lampau yang dilakukan secara pemaksaan oleh pihak laki-laki terhadap perempuan yang disukainya.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Home;