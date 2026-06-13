import React from 'react';
import styles from './Home.module.css';
import Footer from '../../components/Footer/Footer.jsx';

const Home = () => {
  return (
    <div className={styles.home}>
      <div className={styles.bannerHome}>
        <img src="/bn-kekerabatan.webp" alt="Sistem Kekerabatan Adat Bali" className="w-full h-full object-cover"/>
        <div className={styles.bannerOverlay}></div>
      </div>

      <div className={styles.homeSection}>
        <section className="mb-12">
          <div className="text-center">
            <h2 className={styles.sectionTitle}>
              Sistem Silsilah Adat Bali
            </h2>
          </div>
          <p className={styles.sectionContent}>
            Sistem silsilah Adat Bali merupakan dasar yang mengatur tatanan sosial, budaya, dan keagamaan Masyarakat Bali secara hierarkis.
            Sistem ini dikenal dengan istilah <b><i>soroh</i></b> yang menarik garis keturunan <i>purusa</i> untuk menentukan identitas keluarga 
            individu Krama Bali, menjadi dasar untuk menentukan hak (<i>swadikara</i>), kewajiban (<i>swadharma</i>), dan kedudukannya di dalam masyarakat.
            Masyarakat Adat Bali menganut sistem kekerabatan yang disebut <i>patrilineal</i>. Budaya patriarki ini didasarkan pada status peran 
            adat <i>purusa</i> dan <i>predana</i>. Dalam Masyarakat Bali, <i>purusa</i> mengacu pada pihak laki-laki, sedangkan <i>predana</i> mengacu 
            pada pihak perempuan. Konsep ini digunakan sebagai dasar untuk membedakan status peran adat antara laki-laki dan perempuan.
            Sistem pembagian warisan merupakan salah satu budaya Bali yang cenderung bersifat patriarki, yang artinya laki-laki memiliki peran 
            dominan dalam hal warisan. Hal ini dipengaruhi oleh ajaran agama Hindu yang tertulis dalam kitab <b>Manawa Dharmasastra</b>. 
            Silsilah Adat Bali tidak hanya berkaitan dengan keturunan dan pewarisan saja, tetapi juga berkaitan dengan sistem <b>kasta</b> yang 
            terdiri dari empat tingkatan yang disebut <b><i>Catur Warna</i></b>. Catur Warna adalah ajaran Hindu tentang pembagian kerja 
            (<i>swakarma</i>) dan kewajiban (<i>swadharma</i>) dalam kehidupan seseorang di masyarakat. Pembagian masyarakat dalam agama Hindu ini 
            dikelompokkan menjadi empat golongan berdasarkan bakat (<i>guna</i>) dan profesi (<i>karma</i>), yaitu Brahmana, Ksatria, Waisya, dan Sudra
          </p>
        </section>

        <div className={styles.sectionCard}>
          <div className={styles.cardContent}>
            <img src="/semara-ratih.webp" alt="Semara Ratih" className="w-full h-full object-cover"/>
          </div>
          <div className={styles.cardContent}>
            <img src="/perkawinan-bali.webp" alt="Perkawinan Adat Bali" className="w-full h-full object-cover"/>
          </div>
        </div>

        <section className="mb-5">
          <div className="text-center">
            <h2 className={`${styles.sectionTitle} mt-10`}>
              Sistem Kekerabatan Adat Bali
            </h2>
          </div>
          <p className={styles.sectionContent}>
            Sistem Kekerabatan Adat Bali mengacu pada status peran adat <i>purusa</i> dan <i>predana</i> yang merupakan salah satu konsep 
            penting dari ajaran Agama Hindu yang kemudian dijadikan sebagai konsep penting dalam Hukum Adat Bali. Kedua peran adat tersebut 
            memiliki peranan penting sebagai asas atau dasar dalam bidang kekeluargaan, perkawinan, dan pewarisan Hukum Adat Bali. Masyarakat 
            Adat Bali merupakan susunan masyarakat yang kental akan tradisi budaya dan hukum adat. Sistem kekerabatan yang digunakan dalam 
            Adat Bali adalah <i>patrilineal</i>, dimana pewarisan keluarga diambil dari garis keturunan ayah (laki-laki/<i>purusa</i>).
            <i>Purusa</i> dan <i>predana</i> dikatakan sebagai bentuk <b><i>purusa-prakriti</i></b> dalam Agama Hindu yang melambangkan 
            <i>jiwatman</i> yang bersifat kekal (<i>purusa</i>) dan badan kasar yang tidak kekal (<i>prakriti</i>).
          </p>

          <div className={styles.cardKhusus}>
            <Card 
              title="Perkawinan Biasa"
              desc="Perkawinan Biasa adalah perkawinan Adat Bali yang dimana istri ikut ke rumah suami yang berstatus purusa pada perkawinan mereka."
              img="/perkawinan-1.webp" 
            />
            <Card 
              title="Perkawinan Nyentana"
              desc="Perkawinan Nyentana adalah perkawinan Adat Bali dimana suami ikut ke rumah istri yang berstatus purusa pada perkawinan mereka. Disini suami menjadi tanggungjawab dari keluarga istri."
              img="/perkawinan-2.webp" 
            />
            <Card 
              title="Perkawinan Pade Gelahang"
              desc="Perkawinan pade gelahang adalah jenis perkawinan dimana suami dan istri terus hidup sebagai keturunan dari keluarga masing-masing (purusa atau kepurusa) dan melaksanakan tugas dan tanggung jawab (swadharma) secara bersamaan."
              img="/perkawinan-3.webp" 
            />
          </div>

          <p className={`${styles.sectionContent} mt-12`}>
            Perkawinan merupakan salah satu peristiwa yang sangat penting dalam kehidupan masyarakat adat. Perkawinan bukan hanya suatu peristiwa 
            yang mengenai laki-laki dan perempuan, tetapi juga mengenai orang tua, saudara-saudaranya, dan keluarga-keluarganya. Pada Masyarakat 
            Bali dikenal berbagai macam cara perkawinan, yaitu perkawinan meminang (<i>memadik</i>), perkawinan lari bersama (<i>ngerorod</i>), 
            dan perkawinan paksa (<i>melegandang</i>). <i>Memadik</i> adalah perkawinan atas dasar suka sama suka yang didahului adanya lamaran 
            dari pihak laki-laki terhadap perempuan tanpa hambatan. <i>Ngerorod</i> adalah perkawinan atas dasar suka sama suka, tetapi tidak ada 
            lamaran dari pihak laki-laki kepada pihak perempuan karena tidak adanya persetujuan orang tua dari salah satu pihak sehingga jalan 
            lari bersama. <i>Melegandang</i> adalah cara perkawinan yang dilakukan oleh orang masa lampau dimana dilakukan pada laki-laki 
            terhadap perempuan yang dia sukai, tetapi perempuan yang dimaksud tidak suka dengan laki-laki itu sehingga cara pemaksaan ini 
            adalah kehendak laki-laki kepada perempuannya. 
          </p>
        </section>
      </div>
      <Footer />
    </div>
  );
};

// Halper: Menampilkan banyak card
const Card = ({ title, desc, img }) => (
  <div className={`${styles.cardContainer} group`}>
    <div className={styles.cardImage}>
      <img src={img} alt={title} className={styles.imageContent} />
    </div>
    <div className={styles.cardText}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <p className={styles.cardDesc}>{desc}</p>
    </div>
  </div>
);

export default Home;