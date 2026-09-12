import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const FarmContext = createContext(null);

export const useFarm = () => {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error('useFarm must be used within FarmProvider');
  return ctx;
};

export const FarmProvider = ({ children }) => {
  const { user } = useAuth();
  const [farms, setFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState(localStorage.getItem('selectedFarmId'));
  const [loading, setLoading] = useState(true);

  const refreshFarms = useCallback(async () => {
    if (!user) {
      setFarms([]);
      setLoading(false);
      return [];
    }
    try {
      const res = await axios.get(`${BACKEND_URL}/api/farms`);
      setFarms(res.data);
      return res.data;
    } catch (e) {
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refreshFarms();
  }, [refreshFarms]);

  useEffect(() => {
    if (farms.length === 0) return;
    if (!farms.find((f) => f.id === selectedFarmId)) {
      selectFarm(farms[0].id);
    }
  }, [farms]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectFarm = (id) => {
    localStorage.setItem('selectedFarmId', id);
    setSelectedFarmId(id);
  };

  const currentFarm = farms.find((f) => f.id === selectedFarmId) || farms[0] || null;

  return (
    <FarmContext.Provider value={{ farms, currentFarm, selectFarm, refreshFarms, loading }}>
      {children}
    </FarmContext.Provider>
  );
};
