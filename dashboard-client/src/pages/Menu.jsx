import { useState, useEffect } from 'react';
import { authFetch } from '../api';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';

export default function Menu({ api }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Burgers');
  const [price, setPrice] = useState('');

  const load = () => {
    setLoading(true);
    authFetch(`${api}/menu`)
      .then((data) => {
        setItems(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [api]);

  const add = (e) => {
    e.preventDefault();
    if (!name.trim() || !price) return;
    authFetch(`${api}/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), category, price: Number(price) }),
    })
      .then(() => {
        setName('');
        setPrice('');
        load();
      })
      .catch((err) => setError(err.message));
  };

  const remove = (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    authFetch(`${api}/menu/${id}`, { method: 'DELETE' })
      .then(() => {
        setError(null);
        load();
      })
      .catch((err) => setError(err.message));
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="card">
      <h1>المنيو</h1>
      <form onSubmit={add} className="menu-add-form" style={{ marginBottom: '1rem' }}>
        <input
          placeholder="اسم المنتج"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="Burgers">Burgers</option>
          <option value="Pizza">Pizza</option>
          <option value="Drinks">Drinks</option>
          <option value="Extras">Extras</option>
        </select>
        <input
          type="number"
          step="0.01"
          placeholder="السعر"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <button type="submit">إضافة منتج</button>
      </form>
      <div className="table-responsive">
        <table>
        <thead>
          <tr>
            <th>الاسم</th>
            <th>الفئة</th>
            <th>السعر</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.category}</td>
              <td>{item.price}</td>
              <td>
                <button className="secondary" onClick={() => remove(item.id)}>
                  حذف
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}